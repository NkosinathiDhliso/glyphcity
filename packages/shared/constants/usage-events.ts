// Canonical allowlist of consented product-usage event names (audit-gap-closure
// R4). This is the single source of truth shared by the consumer web beacon
// (`packages/shared/lib/usageEvents.ts`) and the backend validator
// (`backend/src/features/events/`). Both import from here so the client and
// server allowlists can never drift. Pure data, no runtime dependencies, so the
// backend can import it without pulling in the browser-only api client.

/**
 * The funnel events the consumer app is allowed to emit. Any name outside this
 * list is dropped client-side (never buffered) and rejected server-side.
 *
 * - Signup funnel:      auth_gate_shown, signup_started, signup_completed
 * - Check-in funnel:    venue_selected, checkin_cta_shown, checkin_completed
 * - Constellation gate: beam_tap, zoom_commit, checkin_completed
 * - First-Get:          firstget_token_entered, firstget_token_redeemed
 * - Proof of demand:    venue_open (carries `source` only, never a venue id)
 * - Silence measure:    venue_probe (detail opened and closed within
 *                       `VENUE_PROBE_MAX_MS`; a sign the glyph did not land,
 *                       GlyphCity rebrand R11.1)
 */
export const USAGE_EVENT_NAMES = [
  'auth_gate_shown',
  'signup_started',
  'signup_completed',
  'venue_selected',
  'checkin_cta_shown',
  'checkin_completed',
  'beam_tap',
  'zoom_commit',
  'firstget_token_entered',
  'firstget_token_redeemed',
  'venue_open',
  'venue_probe',
] as const

/** A venue detail open shorter than this counts as a probe. */
export const VENUE_PROBE_MAX_MS = 2_000

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number]

const USAGE_EVENT_NAME_SET: ReadonlySet<string> = new Set(USAGE_EVENT_NAMES)

/** Type guard: true only for names on the allowlist. */
export function isUsageEventName(name: string): name is UsageEventName {
  return USAGE_EVENT_NAME_SET.has(name)
}
