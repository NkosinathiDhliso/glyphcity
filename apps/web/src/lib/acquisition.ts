/**
 * First-touch Acquisition_Source (GlyphCity rebrand R10.3).
 *
 * The first visit decides where a consumer came from: a creator link
 * (`?ref=creator...`), a shared venue link, a QR code, or none of those
 * (`organic`). It is kept in localStorage so a sign-up days later still credits
 * the first touch, sent once with sign-up, then cleared. Stored through
 * `safeStorage`; where storage is unavailable the visit honestly reads organic.
 *
 * Separate from `venueArrival.ts` on purpose: an arrival is a Venue_Open source
 * for one venue, this is about the person, and the two never mix.
 */
import {
  acquisitionFromRef,
  isAcquisitionSource,
  type AcquisitionSource,
} from '@area-code/shared/constants/attribution'
import { readStored, removeStored, writeStored } from '@area-code/shared/lib/safeStorage'

import { parseVenueArrival } from './venueArrival'

export const ACQUISITION_STORAGE_KEY = 'acquisitionSource'

/** Pure classification of a first visit. */
export function classifyFirstVisit(path: string, search: string): AcquisitionSource {
  let ref: string | null = null
  try {
    ref = new URLSearchParams(search).get('ref')
  } catch {
    ref = null
  }
  const fromRef = acquisitionFromRef(ref)
  if (fromRef) return fromRef
  if (parseVenueArrival(path, search)) return 'share'
  if (/^\/qr\//.test(path)) return 'qr'
  return 'organic'
}

/**
 * Record the first touch from the current URL, unless one is already stored.
 * Call on first paint, before anything rewrites the address bar.
 */
export function captureAcquisitionFromLocation(): AcquisitionSource {
  const stored = readStored('local', ACQUISITION_STORAGE_KEY)
  if (isAcquisitionSource(stored)) return stored
  const source = classifyFirstVisit(window.location.pathname, window.location.search)
  writeStored('local', ACQUISITION_STORAGE_KEY, source)
  return source
}

/** The stored first touch, or `organic` when none was recorded. */
export function readAcquisitionSource(): AcquisitionSource {
  const stored = readStored('local', ACQUISITION_STORAGE_KEY)
  return isAcquisitionSource(stored) ? stored : 'organic'
}

/** Clear after a successful sign-up; the user record is now the source of truth. */
export function clearAcquisitionSource(): void {
  removeStored('local', ACQUISITION_STORAGE_KEY)
}
