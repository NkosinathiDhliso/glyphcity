// DynamoDB-backed leaderboard reset worker (replaces Redis + Prisma)
import { QueryCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

import { getNotificationPreferences } from '../features/notifications/repository.js'
import { rankLeaderboard, toLeaderboardRow } from '../features/social/leaderboard-rank.js'
import { documentClient, TableNames } from '../shared/db/dynamodb.js'

async function getCities() {
  const result = await documentClient.send(
    new ScanCommand({
      TableName: TableNames.appData,
      FilterExpression: 'begins_with(pk, :prefix) AND sk = pk',
      ExpressionAttributeValues: { ':prefix': 'CITY#' },
    }),
  )
  return (result.Items || []).map((c) => ({ id: (c['cityId'] ?? c['pk']) as string, slug: c['slug'] as string }))
}

/**
 * Read ALL leaderboard entries for a city from the canonical key
 * (`pk=LEADERBOARD#{cityId}`), paginating over every page. No Limit cap:
 * lower-ranked entries beyond the first page must be included too.
 */
async function readAllLeaderboardItems(cityId: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined
  do {
    const page = await documentClient.send(
      new QueryCommand({
        TableName: TableNames.appData,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `LEADERBOARD#${cityId}` },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    )
    items.push(...((page.Items ?? []) as Record<string, unknown>[]))
    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastEvaluatedKey)
  return items
}

/** One ranking for the reset and the pre-reset toast, shared with the Ranks read. */
function rankLeaderboardEntries(items: Record<string, unknown>[]) {
  return rankLeaderboard(items.map(toLeaderboardRow))
}

/**
 * Leaderboard reset worker , EventBridge Lambda Monday 00:00 SAST.
 */
export async function handler() {
  console.log('[leaderboard-reset] Starting weekly leaderboard reset')

  const cities = await getCities()
  const weekEnding = new Date().toISOString()
  let totalEntries = 0

  for (const city of cities) {
    // 1. Get ALL leaderboard entries for the city (paginated, canonical key),
    //    then rank across the full set.
    const items = await readAllLeaderboardItems(city.id)
    const entries = rankLeaderboardEntries(items)

    // 2. Archive every entry to leaderboard history.
    for (const e of entries) {
      await documentClient.send(
        new PutCommand({
          TableName: TableNames.appData,
          Item: {
            pk: `LB_HISTORY#${city.id}`,
            sk: `${weekEnding}#${e.userId}`,
            cityId: city.id,
            weekEnding,
            userId: e.userId,
            rank: e.rank,
            // The room count, not the node ids: history keeps no location trail.
            venueCount: e.venueCount,
            checkInCount: e.checkInCount,
          },
        }),
      )
    }

    // 3. Delete every current leaderboard entry, which clears venues and checkInCount.
    for (const item of items) {
      await documentClient.send(
        new DeleteCommand({
          TableName: TableNames.appData,
          Key: { pk: item['pk'] as string, sk: item['sk'] as string },
        }),
      )
    }

    totalEntries += entries.length
    console.log(`[leaderboard-reset] ${city.slug}: ${entries.length} entries persisted`)
  }

  console.log(`[leaderboard-reset] Total entries: ${totalEntries}`)
  return { totalEntries }
}

/**
 * Pre-reset notification , EventBridge Lambda Sunday 20:00 SAST.
 */
export async function preResetHandler() {
  console.log('[leaderboard-reset] Sending pre-reset notifications')

  const cities = await getCities()
  let sent = 0

  for (const city of cities) {
    // Same paginated read + rank as the reset handler (shared helpers), so the
    // ranked users we warn match exactly what the reset will archive.
    const items = await readAllLeaderboardItems(city.id)
    const entries = rankLeaderboardEntries(items)

    for (const entry of entries) {
      const prefs = await getNotificationPreferences(entry.userId)
      if (prefs && prefs['leaderboardPrewarning']) {
        const { emitToast } = await import('../shared/socket/events.js')
        await emitToast(city.slug, {
          type: 'leaderboard',
          message: `Ranks reset tonight. You're #${entry.rank} with ${entry.venueCount} ${entry.venueCount === 1 ? 'room' : 'rooms'} this week.`,
          nodeId: '',
        })
        sent++
      }
    }
  }

  console.log(`[leaderboard-reset] Pre-reset notifications sent: ${sent}`)
  return { sent }
}
