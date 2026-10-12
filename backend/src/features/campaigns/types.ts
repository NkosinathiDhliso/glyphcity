import { z } from 'zod'

// ============================================================================
// Win-Back Campaigns — Types & Zod Schemas
// ----------------------------------------------------------------------------
// Constraint C1 (no SMS / no phone): delivery channels are limited to `push`
// and `email`. There is NO phone-number field anywhere in this module, and the
// `channel` enum structurally forbids any value outside {push, email}. See
// `.kiro/steering/no-sms-no-phone-auth.md`.
// ============================================================================

// ----------------------------------------------------------------------------
// Enumerations
// ----------------------------------------------------------------------------

/** Lifecycle states of a campaign. */
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'cancelled' | 'failed'

/** Audience segments resolvable against the business's own past visitors. */
export type Segment = 'lapsed' | 'first_timers' | 'regulars' | 'all_past_visitors'

/**
 * Delivery channels. Email + push only — there is no SMS/phone channel (C1).
 * Declared as a const tuple so the same source drives both the Zod enum and
 * the TypeScript type.
 */
export const CAMPAIGN_CHANNELS = ['push', 'email'] as const
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number]

// ----------------------------------------------------------------------------
// Aggregate counts (stored on the campaign, never per-consumer identifiers)
// ----------------------------------------------------------------------------

export interface CampaignCounts {
  /** Recipients resolved by the segment (pre-filter). */
  targeted: number
  /** Recipients removed because consent was absent or opted-out. */
  filteredConsent: number
  /** Recipients removed by the platform-wide frequency cap. */
  filteredFreqCap: number
  /** Recipients for whom at least one channel delivery was attempted. */
  attempted: number
  deliveredPush: number
  deliveredEmail: number
  deliveredBoth: number
  noChannel: number
  failed: number
}

// ----------------------------------------------------------------------------
// Core campaign document
// ----------------------------------------------------------------------------

/**
 * A campaign document as stored in the `app-data` table.
 *
 * Key structure (see design.md):
 *   pk:     CAMPAIGN#<businessId>
 *   sk:     CAMPAIGN#<createdAt>#<campaignId>
 *   gsi1pk: CAMPAIGNS#<businessId>
 *   gsi1sk: <createdAt>
 *   ttl:    <createdAt + 13 months>
 *
 * The document contains zero consumer identifiers (POPIA / Requirement 11.4).
 */
export interface Campaign {
  campaignId: string
  businessId: string
  status: CampaignStatus

  // Audience
  segment: Segment
  /** Only meaningful for the `lapsed` segment. Default 21, range 7–90. */
  lapsedWindowDays?: number
  nodeIds: string[]

  // Message
  title: string
  body: string
  channels: CampaignChannel[]
  rewardId?: string
  /** Originating Venue Intelligence Report, when created from a recommendation. */
  reportId?: string

  // Lifecycle timestamps (ISO 8601)
  createdAt: string
  sentAt?: string

  /** Attribution window for return-visit measurement. Default 14 days. */
  attributionWindowDays: number

  /**
   * Per-campaign salt used to derive anonymized recipient tokens. Not a secret;
   * it only rotates the token space so tokens cannot be correlated across
   * campaigns.
   */
  campaignSalt: string

  counts: CampaignCounts

  /** Epoch seconds for DynamoDB TTL (createdAt + 13 months). */
  ttl: number
}

// ----------------------------------------------------------------------------
// Service input / output shapes
// ----------------------------------------------------------------------------

/** Aggregated, anonymized analytics for a campaign (Requirement 11). */
export interface CampaignAnalytics {
  /** Recipients resolved by the segment before filtering. */
  recipientsTargeted: number
  /** Recipients excluded by marketing consent / opt-out. */
  filteredByConsent: number
  /** Recipients excluded by the frequency cap. */
  filteredByFrequencyCap: number
  /** Recipients for whom at least one delivery was attempted. */
  messagesAttempted: number
  deliveredPush: number
  deliveredEmail: number
  deliveredBoth: number
  noChannel: number
  failed: number
  /**
   * Recipients who checked in at one of the campaign's nodes within
   * `attributionWindowDays` after their send (counted once per recipient).
   */
  attributedReturnVisits: number
}

/** A campaign returned with its computed analytics (detail view). */
export interface CampaignWithAnalytics extends Campaign {
  analytics: CampaignAnalytics
}

/** Condensed campaign shape for the paginated list view. */
export interface CampaignSummary {
  campaignId: string
  status: CampaignStatus
  segment: Segment
  title: string
  channels: CampaignChannel[]
  createdAt: string
  sentAt?: string
  /** Headline analytics surfaced in the list (Requirement 13.3). */
  recipients: number
  delivered: number
  attributedReturnVisits: number
}

// ============================================================================
// Zod Schemas
// ============================================================================

/** Query schema for `GET /v1/business/me/campaigns` (paginated list). */
export const campaignListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
})

/** Path-params schema for routes addressing a single campaign. */
export const campaignIdParamsSchema = z.object({
  campaignId: z.string().min(1),
})

/**
 * Query schema for `GET /v1/campaigns/unsubscribe` (one-click email link).
 *
 * The `token` is the signed unsubscribe token embedded in every campaign email
 * (see `unsubscribe.ts`); it carries the recipient + business and is verified
 * server-side. No login and no phone/SMS re-auth is required (Requirement 12.4).
 */
export const unsubscribeQuerySchema = z.object({
  token: z.string().min(1),
})

// ----------------------------------------------------------------------------
// Inferred body/query types
// ----------------------------------------------------------------------------

export type CampaignListQuery = z.infer<typeof campaignListQuerySchema>
export type CampaignIdParams = z.infer<typeof campaignIdParamsSchema>
export type UnsubscribeQuery = z.infer<typeof unsubscribeQuerySchema>
