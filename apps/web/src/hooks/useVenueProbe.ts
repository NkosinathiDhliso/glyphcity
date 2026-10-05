import { VENUE_PROBE_MAX_MS } from '@area-code/shared/constants/usage-events'
import { trackEvent } from '@area-code/shared/lib/usageEvents'
import { useEffect } from 'react'

/** True when a detail open lasted less than the probe threshold. */
export function isVenueProbe(openedAt: number, closedAt: number): boolean {
  return closedAt - openedAt < VENUE_PROBE_MAX_MS
}

/**
 * Emit `venue_probe` when a venue's detail is closed (or swapped for another
 * venue) within `VENUE_PROBE_MAX_MS` of opening: someone looked and backed out,
 * a sign the glyph did not say enough (GlyphCity rebrand R11.1). No venue id is
 * sent; the server labels it with the user's Acquisition_Source.
 */
export function useVenueProbe(nodeId: string | null): void {
  useEffect(() => {
    if (nodeId === null) return
    const openedAt = Date.now()
    return () => {
      if (isVenueProbe(openedAt, Date.now())) trackEvent('venue_probe')
    }
  }, [nodeId])
}
