/**
 * Feature: Proof of demand, Property 1b: the Venue_Open row credits the first
 * open inside the Attribution_Window, exactly as a full history would.
 *
 * **Validates: Requirements 2.3**
 *
 * A consumer may open the same venue many times before they walk in: from the
 * map at noon, from a share link at 17:00, again at the door. The credit belongs
 * to the earliest of those opens that is still inside the window at check-in,
 * and only if it clears the Away_Gate. The row folds opens into runs so it stays
 * small; these properties prove the fold loses nothing a check-in could use:
 *
 *   1. Oracle: for any sequence of opens and any later check-in, resolving the
 *      folded row gives the same `foundVia` as the rule applied to every open.
 *   2. Shape: runs stay oldest first and never overlap, no run is older than
 *      the window measured back from the latest open, and the row never holds
 *      more than `VENUE_OPEN_MAX_RUNS` runs.
 *   3. Overflow only under-claims: past the run cap the answer is the oracle's
 *      or `walk_in`, never a different source.
 *
 * The TTL half of the rule (a repeat open never shortens the window) is asserted
 * on the write itself in `venue-open-route.test.ts`, because the TTL is an
 * argument to the KV write rather than a field of the row.
 */

import {
  ATTRIBUTION_WINDOW_MS,
  AWAY_GATE_MIN_MS,
  OPEN_SOURCES,
  type FoundVia,
  type OpenSource,
} from '@area-code/shared/constants/attribution'
import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import { resolveFoundVia, type VenueOpenRow } from '../found-via.js'
import { mergeVenueOpen, VENUE_OPEN_MAX_RUNS, type VenueOpenInputAt } from '../venue-open.js'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const BASE_MS = Date.UTC(2026, 8, 28, 8, 0, 0)

interface Open {
  source: OpenSource
  at: number
  away: boolean | null
}

/** The rule applied to every open ever made: no folding, no cap. */
function oracle(opens: Open[], checkInAt: number): FoundVia {
  const inWindow = opens.filter((o) => o.at <= checkInAt && checkInAt - o.at <= ATTRIBUTION_WINDOW_MS)
  const earliest = inWindow.reduce<Open | null>((min, o) => (min === null || o.at < min.at ? o : min), null)
  if (!earliest) return 'walk_in'
  if (checkInAt - earliest.at >= AWAY_GATE_MIN_MS) return earliest.source
  if (inWindow.some((o) => o.away === true)) return earliest.source
  return 'walk_in'
}

function fold(opens: Open[]): VenueOpenRow | null {
  let row: VenueOpenRow | null = null
  for (const o of opens) {
    const incoming: VenueOpenInputAt = { source: o.source, openedAt: new Date(o.at).toISOString(), away: o.away }
    row = mergeVenueOpen(row, incoming)
  }
  return row
}

const openArb = fc.record({
  source: fc.constantFrom(...OPEN_SOURCES),
  // Gaps from seconds to hours, so runs both form and break, and early opens
  // age out of the window before the check-in.
  gapMs: fc.oneof(fc.integer({ min: 0, max: 25 * MINUTE_MS }), fc.integer({ min: 0, max: 5 * HOUR_MS })),
  away: fc.constantFrom(true, false, null),
})

/** Opens in server order: each one at or after the one before. */
function toOpens(raw: Array<{ source: OpenSource; gapMs: number; away: boolean | null }>): Open[] {
  let at = BASE_MS
  return raw.map((r) => {
    at += r.gapMs
    return { source: r.source, at, away: r.away }
  })
}

/** A check-in at or after the last open: a live check-in. */
const afterLastArb = fc.integer({ min: 0, max: 8 * HOUR_MS })

describe('Feature: Proof of demand, Property 1b: Venue_Open row matches the full history', () => {
  it('resolves exactly as the rule over every open, for any later check-in', () => {
    fc.assert(
      fc.property(fc.array(openArb, { minLength: 1, maxLength: 12 }), afterLastArb, (raw, delayMs) => {
        const opens = toOpens(raw)
        const checkInAt = opens[opens.length - 1]!.at + delayMs

        expect(resolveFoundVia(fold(opens), new Date(checkInAt).toISOString())).toBe(oracle(opens, checkInAt))
      }),
      { numRuns: 1000 },
    )
  })

  it('credits the later look when the earlier one aged out (noon map, 17:00 share, 21:00 check-in)', () => {
    const opens: Open[] = [
      { source: 'map', at: BASE_MS + 4 * HOUR_MS, away: null },
      { source: 'share', at: BASE_MS + 9 * HOUR_MS, away: null },
    ]
    const checkInAt = BASE_MS + 13 * HOUR_MS

    expect(resolveFoundVia(fold(opens), new Date(checkInAt).toISOString())).toBe('share')
  })

  it('credits the 14:00 reopen at a 16:00 check-in after a 09:00 look (promoter-arrivals design)', () => {
    // Replacing the stored open only once it is past the window does not fix
    // this: at 14:00 the 09:00 look is five hours old, so it would stay first
    // and the check-in would read seven hours and stamp walk_in.
    const opens: Open[] = [
      { source: 'map', at: BASE_MS + 1 * HOUR_MS, away: null },
      { source: 'map', at: BASE_MS + 6 * HOUR_MS, away: true },
    ]
    const checkInAt = BASE_MS + 8 * HOUR_MS

    expect(resolveFoundVia(fold(opens), new Date(checkInAt).toISOString())).toBe('map')
  })

  it('never discards an away open inside the window', () => {
    fc.assert(
      fc.property(fc.array(openArb, { minLength: 1, maxLength: 12 }), (raw) => {
        const opens = toOpens(raw)
        const last = opens[opens.length - 1]!
        const withAway = [...opens.slice(0, -1), { ...last, away: true }]

        expect(resolveFoundVia(fold(withAway), new Date(last.at).toISOString())).not.toBe('walk_in')
      }),
      { numRuns: 300 },
    )
  })
})

describe('Feature: Proof of demand, Property 1b: Venue_Open row shape', () => {
  it('keeps runs ordered, disjoint, inside the window and under the cap', () => {
    fc.assert(
      fc.property(fc.array(openArb, { minLength: 1, maxLength: 60 }), (raw) => {
        const opens = toOpens(raw)
        const row = fold(opens)!
        const latest = opens[opens.length - 1]!.at

        expect(row.opens.length).toBeGreaterThan(0)
        expect(row.opens.length).toBeLessThanOrEqual(VENUE_OPEN_MAX_RUNS)
        row.opens.forEach((run, i) => {
          expect(Date.parse(run.lastOpenedAt)).toBeGreaterThanOrEqual(Date.parse(run.openedAt))
          expect(Date.parse(run.lastOpenedAt)).toBeGreaterThanOrEqual(latest - ATTRIBUTION_WINDOW_MS)
          const previous = row.opens[i - 1]
          if (previous) expect(Date.parse(run.openedAt)).toBeGreaterThanOrEqual(Date.parse(previous.lastOpenedAt))
        })
      }),
      { numRuns: 300 },
    )
  })

  it('takes the incoming open as a single run when there is no row yet', () => {
    fc.assert(
      fc.property(fc.constantFrom(...OPEN_SOURCES), fc.constantFrom(true, false, null), (source, away) => {
        const openedAt = new Date(BASE_MS).toISOString()

        expect(mergeVenueOpen(null, { source, openedAt, away })).toEqual({
          opens: [{ source, openedAt, lastOpenedAt: openedAt, away }],
        })
      }),
      { numRuns: 100 },
    )
  })
})

describe('Feature: Proof of demand, Property 1b: overflow only under-claims', () => {
  it('answers as the oracle or walk_in, never another source, past the run cap', () => {
    // Alternating sources a minute apart never fold, so the cap is reached.
    const flood = fc.array(fc.constantFrom(true, false, null), {
      minLength: VENUE_OPEN_MAX_RUNS + 1,
      maxLength: VENUE_OPEN_MAX_RUNS + 20,
    })

    fc.assert(
      fc.property(flood, afterLastArb, (aways, delayMs) => {
        const opens: Open[] = aways.map((away, i) => ({
          source: i % 2 === 0 ? 'map' : 'share',
          at: BASE_MS + i * MINUTE_MS,
          away,
        }))
        const checkInAt = opens[opens.length - 1]!.at + delayMs
        const result = resolveFoundVia(fold(opens), new Date(checkInAt).toISOString())

        expect([oracle(opens, checkInAt), 'walk_in']).toContain(result)
      }),
      { numRuns: 300 },
    )
  })
})

describe('Feature: Proof of demand, Property 1b: threshold precondition', () => {
  it('keeps the window at least twice the time arm, which run folding relies on', () => {
    // A run whose first open aged out is credited on the time arm because its
    // earliest in-window open is older than the window minus one gap.
    expect(ATTRIBUTION_WINDOW_MS - AWAY_GATE_MIN_MS).toBeGreaterThanOrEqual(AWAY_GATE_MIN_MS)
  })
})
