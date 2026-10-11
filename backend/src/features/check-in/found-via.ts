/**
 * Away_Gate and Found_Via resolution (proof-of-demand R2.3, R2.4, R3.7).
 *
 * One question, answered in one place: did this consumer find the venue on
 * Area Code before they walked in, or were they already in the room? The answer
 * is stamped on every check-in as `foundVia` and is the only number allowed next
 * to the word "found" on an owner surface, so it has to be defensible to a
 * sceptical owner.
 *
 * Pure: no clock, no I/O, no globals. The caller passes the Venue_Open row it
 * read from the KV and the check-in instant (`capturedAt` for an offline replay,
 * else now), so the whole rule is testable without a database.
 *
 * The rule: the first open inside the Attribution_Window before the check-in
 * earns the credit, and only if it clears the Away_Gate.
 *
 * 1. No row, or no open inside the window → `walk_in`. A QR scan at the till
 *    with no earlier open is a Walk_In by construction, and a morning look that
 *    aged out cannot hide a later one that did not.
 * 2. Any unreadable or out-of-order run, or an unreadable instant → `walk_in`.
 *    We cannot tell which open came first, so we do not claim the credit.
 * 3. The earliest in-window open is at least `AWAY_GATE_MIN_MINUTES` old → its
 *    source. `away === null` (position unknown) relies on this time arm alone.
 * 4. Any in-window open was made away from the venue → the earliest one's
 *    source. The consumer was outside the check-in radius when they looked.
 * 5. Otherwise → `walk_in`. Someone who opened the app in the room minutes
 *    before checking in is not demand we created.
 *
 * Every branch that cannot be verified resolves to `walk_in`: the gate errs
 * toward under-claiming, never toward selling a walk-in as demand
 * (`honest-presence.md`). Thresholds come from
 * `@area-code/shared/constants/attribution`; this file defines none of its own
 * (R3.7).
 */

import {
  ATTRIBUTION_WINDOW_MS,
  AWAY_GATE_MIN_MS,
  OPEN_SOURCES,
  type FoundVia,
  type OpenSource,
} from '@area-code/shared/constants/attribution'

/** The honest default outcome. */
const WALK_IN: FoundVia = 'walk_in'

/**
 * One run of opens: consecutive opens from the same source, each less than the
 * Away_Gate time arm after the one before (see `mergeVenueOpen`). A single open
 * is a run whose `openedAt` equals its `lastOpenedAt`.
 *
 * Why a run is enough: when a run's first open has aged out of the window but
 * its last has not, some member sits within one gap of the window's start, so
 * the earliest in-window open of that run is older than the window minus the
 * time arm. That is past the time arm itself (5h40 against 20 minutes), so the
 * run is credited exactly as the full list of opens would be.
 */
export interface VenueOpenRun {
  /** Where every open in this run came from. */
  source: OpenSource
  /** ISO instant of the run's first open. */
  openedAt: string
  /** ISO instant of the run's latest open. */
  lastOpenedAt: string
  /** Was the consumer outside the check-in radius on any open of the run? */
  away: boolean | null
}

/**
 * The `open:{userId}:{nodeId}` KV row, as stored by the Venue_Open service:
 * runs in time order, oldest first, none overlapping. No coordinates, no device
 * data, no display name (R11.1): `away` is the only spatial fact and it is a
 * boolean.
 */
export interface VenueOpenRow {
  opens: VenueOpenRun[]
}

/**
 * Resolve the `foundVia` for one check-in.
 *
 * @param row The Venue_Open row for this consumer and venue, or `null` when
 *   none exists (absent or already expired by TTL).
 * @param checkInInstantIso The instant the check-in happened: `capturedAt` for
 *   an offline replay, otherwise now.
 * @returns The source of the earliest open inside the Attribution_Window when
 *   the Away_Gate passes, otherwise `walk_in`.
 */
export function resolveFoundVia(row: VenueOpenRow | null, checkInInstantIso: string): FoundVia {
  const checkInAt = epochMs(checkInInstantIso)
  if (!row || checkInAt === null) return WALK_IN

  const runs: Array<{ source: OpenSource; first: number; last: number; away: boolean | null }> = []
  for (const run of row.opens) {
    const first = epochMs(run.openedAt)
    const last = epochMs(run.lastOpenedAt)
    if (!isOpenSource(run.source) || first === null || last === null || last < first) return WALK_IN
    // Runs are stored oldest first and never overlap. A row that breaks that
    // cannot say which open came first.
    const previous = runs[runs.length - 1]
    if (previous && first < previous.last) return WALK_IN
    runs.push({ source: run.source, first, last, away: run.away })
  }

  const windowStart = checkInAt - ATTRIBUTION_WINDOW_MS
  // A run is live when one of its opens lies inside [windowStart, checkInAt].
  // An open after the check-in (clock skew, or a replay judged at its capture)
  // is never creditable.
  const live = runs.filter((run) => run.first <= checkInAt && run.last >= windowStart)
  const earliest = live[0]
  if (!earliest) return WALK_IN

  // First open aged out, a later one in the same run did not: that one is older
  // than the window minus the time arm, so the time arm passes (see VenueOpenRun).
  if (earliest.first < windowStart) return earliest.source
  if (checkInAt - earliest.first >= AWAY_GATE_MIN_MS) return earliest.source

  // A run that runs past the check-in may carry an away flag from an open after
  // it, so only a run that ended by the check-in can prove the consumer was away.
  if (live.some((run) => run.away === true && run.last <= checkInAt)) return earliest.source
  return WALK_IN
}

/** Epoch milliseconds, or null when the value is not a readable instant. */
function epochMs(iso: string): number | null {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * A KV row is untyped JSON at read time, so a source that is not one of the
 * accepted Open_Sources makes the whole row unverifiable rather than trusted.
 * `walk_in` is never a source, only an outcome, so it fails this check too.
 */
function isOpenSource(value: string): value is OpenSource {
  return (OPEN_SOURCES as readonly string[]).includes(value)
}
