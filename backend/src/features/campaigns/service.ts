// ============================================================================
// Win-Back Campaigns — read paths only
// ----------------------------------------------------------------------------
// Win-back campaigns are retired (north-star-alignment R8.3,
// `docs/decisions/north-star-alignment.md` decision 3). Nothing creates, sends
// or cancels a campaign any more. A business can still read its own past
// campaigns, with the delivery counts the sender stored when it ran.
// ============================================================================

import { AppError } from '../../shared/errors/AppError.js'

import { getCampaignById, listCampaigns as listCampaignsFromRepo } from './repository.js'
import type { Campaign, CampaignAnalytics, CampaignSummary, CampaignWithAnalytics } from './types.js'

/** A campaign was not found for the business (or belongs to another business). */
export class CampaignNotFoundError extends AppError {
  constructor(campaignId: string) {
    super(404, 'not_found', `Campaign ${campaignId} not found`)
    this.name = 'CampaignNotFoundError'
  }
}

/** A business's past campaigns, newest first, with their stored counts. */
export async function listCampaigns(
  businessId: string,
  opts: { cursor?: string; limit?: number } = {},
): Promise<{ items: CampaignSummary[]; nextCursor?: string }> {
  const { items, nextCursor } = await listCampaignsFromRepo(businessId, opts)

  const summaries: CampaignSummary[] = items.map((c) => {
    const analytics = analyticsFromCounts(c)
    return {
      campaignId: c.campaignId,
      status: c.status,
      segment: c.segment,
      title: c.title,
      channels: c.channels,
      createdAt: c.createdAt,
      sentAt: c.sentAt,
      recipients: analytics.messagesAttempted,
      delivered: analytics.deliveredPush + analytics.deliveredEmail + analytics.deliveredBoth,
      attributedReturnVisits: analytics.attributedReturnVisits,
    }
  })

  return { items: summaries, nextCursor }
}

/** One past campaign with its stored counts. 404 when it is not this business's. */
export async function getCampaign(businessId: string, campaignId: string): Promise<CampaignWithAnalytics> {
  const campaign = await getCampaignById(businessId, campaignId)
  if (!campaign) throw new CampaignNotFoundError(campaignId)

  return { ...campaign, analytics: analyticsFromCounts(campaign) }
}

/**
 * A campaign's stored aggregate counts in the analytics shape. Return visits
 * are not re-measured: that needed the retired send pipeline, so they read 0.
 */
function analyticsFromCounts(campaign: Campaign): CampaignAnalytics {
  const c = campaign.counts
  return {
    recipientsTargeted: c.targeted,
    filteredByConsent: c.filteredConsent,
    filteredByFrequencyCap: c.filteredFreqCap,
    messagesAttempted: c.attempted,
    deliveredPush: c.deliveredPush,
    deliveredEmail: c.deliveredEmail,
    deliveredBoth: c.deliveredBoth,
    noChannel: c.noChannel,
    failed: c.failed,
    attributedReturnVisits: 0,
  }
}
