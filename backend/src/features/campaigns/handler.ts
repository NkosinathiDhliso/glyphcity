import type { FastifyInstance } from 'fastify'

import { requireAuth } from '../../shared/middleware/auth.js'
import { requireBusinessPermission, getBusinessRole } from '../../shared/middleware/business-role.js'
import { validate } from '../../shared/middleware/validation.js'

import { putOptOut } from './repository.js'
import { listCampaigns, getCampaign } from './service.js'
import { campaignListQuerySchema, campaignIdParamsSchema, unsubscribeQuerySchema } from './types.js'
import type { CampaignListQuery, CampaignIdParams, UnsubscribeQuery } from './types.js'
import { verifyUnsubscribeToken } from './unsubscribe.js'

// ============================================================================
// Win-Back Campaigns — what stays after retirement
// ----------------------------------------------------------------------------
// Campaigns are retired (north-star-alignment R8.3). Two business reads stay so
// a business can see its own past campaigns, behind the same owner/manager
// permission, and the one-click unsubscribe stays so a link already in an inbox
// still works. Nothing here creates, sends or cancels a campaign.
// ============================================================================

const CAMPAIGN_PERMISSION = 'manage_campaigns'

export async function campaignRoutes(app: FastifyInstance) {
  // GET /v1/business/me/campaigns — paginated list, newest first (Requirement 11.3)
  app.get(
    '/v1/business/me/campaigns',
    {
      preHandler: [
        requireAuth('business', 'staff'),
        requireBusinessPermission(CAMPAIGN_PERMISSION),
        validate({ query: campaignListQuerySchema }),
      ],
    },
    async (request) => {
      const { businessId } = getBusinessRole(request)
      const query = request.query as CampaignListQuery
      return listCampaigns(businessId, { cursor: query.cursor, limit: query.limit })
    },
  )

  // GET /v1/business/me/campaigns/:campaignId — detail + analytics (Requirement 11.3)
  app.get(
    '/v1/business/me/campaigns/:campaignId',
    {
      preHandler: [
        requireAuth('business', 'staff'),
        requireBusinessPermission(CAMPAIGN_PERMISSION),
        validate({ params: campaignIdParamsSchema }),
      ],
    },
    async (request) => {
      const { businessId } = getBusinessRole(request)
      const params = request.params as CampaignIdParams
      return getCampaign(businessId, params.campaignId)
    },
  )
}

// ============================================================================
// One-click unsubscribe (Requirement 12.4)
// ----------------------------------------------------------------------------
// The link embedded in every campaign email that was sent. The signed token
// (`unsubscribe.ts`) carries the recipient `userId` and the sending
// `businessId`; it is HMAC-verified, then a per-business `COPTOUT#` row is
// written. No login and no phone or SMS re-auth: it is clicked straight from an
// inbox, so it answers with a small confirmation page.
// ============================================================================

/** Minimal styled HTML confirmation page returned by the one-click route. */
function unsubscribePage(title: string, message: string): string {
  // Self-contained, inline-styled page — no external assets, safe to render
  // straight from an email client's in-app browser. The title/message strings
  // are static (no user-controlled interpolation) so there is no injection risk.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #0f1115; color: #e8eaed; margin: 0; display: flex;
         min-height: 100vh; align-items: center; justify-content: center; }
  .card { background: #1a1d24; border-radius: 16px; padding: 40px 32px; max-width: 420px;
          text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.4); }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 1.5; color: #aab1bd; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
}

export async function campaignConsumerRoutes(app: FastifyInstance) {
  // GET /v1/campaigns/unsubscribe?token=... — one-click email unsubscribe, no
  // login, no phone/SMS re-auth (Requirement 12.4 / Constraint C1).
  app.get(
    '/v1/campaigns/unsubscribe',
    {
      preHandler: [validate({ query: unsubscribeQuerySchema })],
    },
    async (request, reply) => {
      const { token } = request.query as UnsubscribeQuery

      const verified = verifyUnsubscribeToken(token)
      if (!verified) {
        // Malformed or tampered token — write nothing, show a friendly notice.
        return reply
          .status(400)
          .type('text/html')
          .send(
            unsubscribePage(
              'Unsubscribe link invalid',
              'This unsubscribe link is invalid or has expired. You can manage your preferences from inside the app at any time.',
            ),
          )
      }

      // Valid token → per-business opt-out from the email's sending business.
      await putOptOut(verified.userId, verified.businessId)

      return reply
        .status(200)
        .type('text/html')
        .send(unsubscribePage("You're unsubscribed", 'You will no longer receive emails from this business.'))
    },
  )
}
