// "Tonight at a place you know": one evening message naming one room the guest
// has been to, that has a Tonight today (north-star-alignment R3). It replaces
// the streak reminder, which asked for a check-in anywhere to protect a number.
//
// Honest by construction:
//   - Opt-in only: `tonightAtKnownVenue` is off by default, and delivery goes
//     through `sendNotification`, whose preference gate reads it.
//   - The copy says what the venue announced, nothing about a streak, a count
//     or a reward.
//   - A guest already marked going for that venue and night is left to the
//     existing Tonight_Reminder, which covers them.
//   - At most one message per guest per night (dedup key, 26 h TTL).
//
// Serverless-only: the same EventBridge evening slot the streak reminder used.
// Cost: one users scan per evening, as before. Past ten thousand users a
// follow-up adds a GSI on the preference; it does not exist yet.
import type { VenueTonight } from '@area-code/shared/types'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'

import { getCheckInsByUser } from '../features/check-in/dynamodb-repository.js'
import { getNodeById } from '../features/nodes/dynamodb-repository.js'
import { isGoing } from '../features/nodes/going-repository.js'
import { loadTonightByBusiness } from '../features/nodes/tonight-reader.js'
import { getPreferences, sendNotification } from '../features/notifications/service.js'
import { documentClient, TableNames } from '../shared/db/dynamodb.js'
import { kvGet, kvSet } from '../shared/kv/dynamodb-kv.js'
import { pushVenueUrl } from '../shared/links/venue-arrival.js'
import { nightFor } from '../shared/time/sast.js'

/** How far back a visit makes a venue "a place you know". */
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000
/** Check-ins read per guest, most recent first. */
const CHECKIN_READ_LIMIT = 200
/** Distinct venues considered per guest, most recent first. */
const VENUE_LIMIT = 10
/** At-most-once-per-night dedup TTL (26 h covers a late run and the next night's run). */
const DEDUP_TTL_SECONDS = 26 * 60 * 60

function dedupKey(userId: string, night: string): string {
  return `notif:tonight_known:${userId}:${night}`
}

/** Distinct node ids in the order given (most recent first), capped at `limit`. */
export function recentDistinctNodeIds(nodeIdsMostRecentFirst: readonly string[], limit: number): string[] {
  return [...new Set(nodeIdsMostRecentFirst)].slice(0, limit)
}

/**
 * The venue to name tonight: the first visited venue, in visit order, that has
 * a Tonight and that the guest has not already marked going for. Null when
 * there is none, which means no message.
 */
export function pickTonightVenue(
  visitedNodeIdsInOrder: readonly string[],
  tonightByNodeId: ReadonlyMap<string, unknown>,
  goingNodeIds: ReadonlySet<string>,
): string | null {
  for (const nodeId of visitedNodeIdsInOrder) {
    if (tonightByNodeId.has(nodeId) && !goingNodeIds.has(nodeId)) return nodeId
  }
  return null
}

/** Send one guest their message, or nothing. Returns whether a message went out. */
async function remindOne(userId: string, nowMs: number): Promise<boolean> {
  const prefs = await getPreferences(userId)
  if ((prefs as { tonightAtKnownVenue?: boolean }).tonightAtKnownVenue !== true) return false

  const night = nightFor(nowMs)
  const key = dedupKey(userId, night)
  if (await kvGet(key)) return false

  const nowIso = new Date(nowMs).toISOString()
  const { checkIns } = await getCheckInsByUser(userId, {
    startTime: new Date(nowMs - LOOKBACK_MS).toISOString(),
    endTime: nowIso,
    limit: CHECKIN_READ_LIMIT,
  })
  const visited = recentDistinctNodeIds(
    checkIns.map((c) => c.nodeId),
    VENUE_LIMIT,
  )
  if (visited.length === 0) return false

  const nodes = (await Promise.all(visited.map((id) => getNodeById(id)))).filter((n) => n !== null)
  const tonightByBusiness = await loadTonightByBusiness(
    nodes.map((n) => n.businessId),
    nowIso,
  )
  const tonightByNodeId = new Map<string, VenueTonight>()
  for (const node of nodes) {
    const tonight = node.businessId ? tonightByBusiness.get(node.businessId) : undefined
    if (tonight) tonightByNodeId.set(node.nodeId, tonight)
  }
  if (tonightByNodeId.size === 0) return false

  const nowSeconds = Math.floor(nowMs / 1000)
  const goingNodeIds = new Set<string>()
  for (const nodeId of tonightByNodeId.keys()) {
    if (await isGoing({ userId, nodeId, date: night }, nowSeconds)) goingNodeIds.add(nodeId)
  }

  const pick = pickTonightVenue(visited, tonightByNodeId, goingNodeIds)
  if (pick === null) return false
  const node = nodes.find((n) => n.nodeId === pick)!
  const tonight = tonightByNodeId.get(pick)!

  await sendNotification({
    userId,
    type: 'tonight_at_known_venue',
    title: node.name,
    body: `Expected tonight: ${tonight.headline}`,
    data: { nodeId: pick, date: night, ...pushVenueUrl(node.slug) },
  })
  // Mark done only after a send attempt so a mid-run crash can retry.
  await kvSet(key, '1', DEDUP_TTL_SECONDS)
  return true
}

/**
 * Scan every consumer and message the opted-in ones who know a room with a
 * Tonight. Lock rows (email and sub locks) carry `lockType` and are skipped.
 * Per-user failures are logged and skipped so one bad row never aborts the sweep.
 */
export async function handler() {
  console.log('[tonight-known-venue-reminder] Starting')

  const nowMs = Date.now()
  let scanned = 0
  let reminded = 0
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await documentClient.send(
      new ScanCommand({
        TableName: TableNames.users,
        FilterExpression: 'attribute_not_exists(lockType)',
        ProjectionExpression: 'userId',
        ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
      }),
    )

    for (const item of result.Items || []) {
      const userId = item['userId'] as string
      scanned++
      try {
        if (await remindOne(userId, nowMs)) reminded++
      } catch (err) {
        console.warn(`[tonight-known-venue-reminder] skipped user ${userId}: ${String(err)}`)
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined
  } while (lastKey)

  console.log(`[tonight-known-venue-reminder] Reminded ${reminded} of ${scanned} users`)
  return { scanned, reminded }
}
