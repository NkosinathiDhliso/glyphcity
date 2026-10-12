// DynamoDB-backed Win-Back Campaigns Repository, what stays after retirement
// (north-star-alignment R8.3): the opt-out write behind the one-click
// unsubscribe link, and the reads of a business's own past campaigns. Storage
// is the existing `app-data` table (pk/sk + GSI1). No phone number is read,
// written, or required anywhere in this module (Constraint C1).
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'

import { documentClient, TableNames, queryFirstMatch } from '../../shared/db/dynamodb.js'

import type { Campaign } from './types.js'

// ============================================================================
// Opt-Out Records (app-data)
// ----------------------------------------------------------------------------
//   pk: COPTOUT#<userId>
//   sk: COPTOUT#<businessId>  |  COPTOUT#ALL
//   optedOutAt
// ============================================================================

/**
 * Record a consumer opt-out.
 *
 * Pass a `businessId` to opt out of campaigns from that business, or the
 * literal `'ALL'` to opt out of every business globally (Requirement 12.1).
 * Writing the same opt-out twice is idempotent (it simply refreshes
 * `optedOutAt`).
 */
export async function putOptOut(userId: string, businessId: string | 'ALL'): Promise<void> {
  await documentClient.send(
    new PutCommand({
      TableName: TableNames.appData,
      Item: {
        pk: `COPTOUT#${userId}`,
        sk: `COPTOUT#${businessId}`,
        optedOutAt: new Date().toISOString(),
      },
    }),
  )
}

/**
 * Load a single campaign by business + campaignId.
 *
 * Queries the GSI1 partition `CAMPAIGNS#<businessId>` and filters by the
 * denormalized `campaignId`, then parses the stored `data` blob. Mirrors the
 * reports repository's `getReport` lookup. Returns null when not found (or when
 * the campaign belongs to a different business).
 */
export async function getCampaignById(businessId: string, campaignId: string): Promise<Campaign | null> {
  // Filter across the whole business partition (paginated), never with Limit: 1.
  // DynamoDB applies Limit before the FilterExpression, so Limit: 1 examines
  // only the first-indexed campaign — win-back sends and the campaigns detail
  // view break the moment a business has 2+ campaigns.
  const item = await queryFirstMatch({
    TableName: TableNames.appData,
    IndexName: 'GSI1',
    KeyConditionExpression: 'gsi1pk = :gsi1pk',
    FilterExpression: 'campaignId = :campaignId',
    ExpressionAttributeValues: {
      ':gsi1pk': `CAMPAIGNS#${businessId}`,
      ':campaignId': campaignId,
    },
  })

  if (!item) return null

  try {
    return JSON.parse(item['data'] as string) as Campaign
  } catch (err) {
    console.error(
      `[campaigns/repository] Corrupt campaign JSON, skipping row pk=${item['pk']} sk=${item['sk']} campaignId=${campaignId}:`,
      err,
    )
    return null
  }
}

/** Default page size for the paginated campaign list (Requirement 11.3). */
const CAMPAIGN_LIST_PAGE_SIZE = 20

/** Hard ceiling on the page size a caller may request. */
const CAMPAIGN_LIST_MAX_PAGE_SIZE = 50

/**
 * List a business's campaigns sorted by creation date descending.
 *
 * Queries the GSI1 partition `CAMPAIGNS#<businessId>` with `ScanIndexForward
 * = false` so the most-recently-created campaigns come first (Requirement
 * 11.3). Mirrors the reports repository's `listReports` pagination: the cursor
 * is the base64-encoded `LastEvaluatedKey`. Each row's full `data` blob is
 * parsed back into a `Campaign`; the service layer maps these to the condensed
 * `CampaignSummary` shape for the list view.
 *
 * No consumer identifiers are read or returned — campaign documents contain
 * only aggregate counts (POPIA / Requirement 11.4).
 */
export async function listCampaigns(
  businessId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ items: Campaign[]; nextCursor?: string }> {
  const limit = Math.min(Math.max(opts.limit ?? CAMPAIGN_LIST_PAGE_SIZE, 1), CAMPAIGN_LIST_MAX_PAGE_SIZE)

  const result = await documentClient.send(
    new QueryCommand({
      TableName: TableNames.appData,
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :gsi1pk',
      ExpressionAttributeValues: { ':gsi1pk': `CAMPAIGNS#${businessId}` },
      ScanIndexForward: false, // newest first (date desc)
      Limit: limit,
      ...(opts.cursor ? { ExclusiveStartKey: JSON.parse(Buffer.from(opts.cursor, 'base64').toString()) } : {}),
    }),
  )

  const items: Campaign[] = []
  for (const item of result.Items || []) {
    try {
      items.push(JSON.parse(item['data'] as string) as Campaign)
    } catch (err) {
      // Skip a malformed row rather than failing the whole page.
      console.error(
        `[campaigns/repository] Corrupt campaign JSON, skipping row pk=${item['pk']} sk=${item['sk']}:`,
        err,
      )
    }
  }

  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : undefined

  return { items, nextCursor }
}
