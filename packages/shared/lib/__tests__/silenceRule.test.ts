/**
 * Silence decision rule (GlyphCity rebrand R11.3, decision 10).
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { ACQUISITION_LABELS, type AcquisitionLabel } from '../../constants/attribution'
import {
  FUNNEL_EVENTS,
  SILENCE_MARGIN_POINTS,
  SILENCE_METRICS,
  emptySourceWeek,
  formatGap,
  formatRate,
  funnelRates,
  gapPoints,
  nonCreator,
  silenceVerdict,
  type FunnelWeek,
  type SourceWeek,
} from '../silenceRule'

/** A source-week with `opens` of `taps` and `day1` of `signups`. */
function sw(taps: number, opens: number, signups = 0, day1 = 0): SourceWeek {
  const week = emptySourceWeek()
  week.events.venue_selected = taps
  week.events.venue_open = opens
  return { ...week, signups, day1 }
}

function week(
  weekStart: string,
  complete: boolean,
  sources: Partial<Record<AcquisitionLabel, SourceWeek>>,
): FunnelWeek {
  const all = Object.fromEntries(ACQUISITION_LABELS.map((l) => [l, sources[l] ?? emptySourceWeek()]))
  return { weekStart, complete, sources: all as FunnelWeek['sources'] }
}

// Creator opens 80 of 100, everyone else 50 of 100: a 30 point gap.
const trailing = { creator: sw(100, 80), organic: sw(100, 50) }
// Creator 60, everyone else 50: a 10 point gap.
const close = { creator: sw(100, 60), organic: sw(100, 50) }

describe('silenceVerdict', () => {
  it('proposes the next cue after two complete trailing weeks', () => {
    const v = silenceVerdict([week('2026-09-28', true, trailing), week('2026-09-21', true, trailing)])
    expect(v).toEqual({ status: 'propose_next_cue', metric: 'mapToDetail', weeks: ['2026-09-28', '2026-09-21'] })
  })

  it('holds when only one of the two weeks trails', () => {
    const v = silenceVerdict([week('2026-09-28', true, trailing), week('2026-09-21', true, close)])
    expect(v.status).toBe('hold')
  })

  it('ignores the open week', () => {
    const v = silenceVerdict([
      week('2026-10-05', false, close),
      week('2026-09-28', true, trailing),
      week('2026-09-21', true, trailing),
    ])
    expect(v.status).toBe('propose_next_cue')
    expect(v.weeks).toEqual(['2026-09-28', '2026-09-21'])
  })

  it('needs two complete weeks', () => {
    expect(silenceVerdict([week('2026-09-28', true, trailing)]).status).toBe('not_enough_data')
  })

  it('needs both sides to have a denominator', () => {
    const creatorOnly = { creator: sw(100, 80) }
    const v = silenceVerdict([week('2026-09-28', true, creatorOnly), week('2026-09-21', true, creatorOnly)])
    expect(v.status).toBe('not_enough_data')
  })

  it('treats exactly the margin as not trailing ("more than")', () => {
    const atMargin = { creator: sw(100, 65), organic: sw(100, 50) }
    expect(gapPoints(week('2026-09-28', true, atMargin), 'mapToDetail')).toBe(SILENCE_MARGIN_POINTS)
    const v = silenceVerdict([week('2026-09-28', true, atMargin), week('2026-09-21', true, atMargin)])
    expect(v.status).toBe('hold')
  })

  it('reads Day 1 as the second measure', () => {
    const day1 = { creator: sw(0, 0, 10, 6), share: sw(0, 0, 10, 2) }
    const v = silenceVerdict([week('2026-09-28', true, day1), week('2026-09-21', true, day1)])
    expect(v).toMatchObject({ status: 'propose_next_cue', metric: 'day1' })
  })

  it('pools share, qr and organic, and leaves unknown out', () => {
    const w = week('2026-09-28', true, { share: sw(10, 5), qr: sw(10, 5), organic: sw(10, 5), unknown: sw(10, 10) })
    expect(nonCreator(w).events.venue_selected).toBe(30)
    expect(funnelRates(nonCreator(w)).mapToDetail).toBe(0.5)
  })
})

describe('formatting', () => {
  it('formats rates and gaps, with n/a for no data', () => {
    expect(formatRate(0.5)).toBe('50.0%')
    expect(formatRate(null)).toBe('n/a')
    expect(formatGap(12.5)).toBe('+12.5 pts')
    expect(formatGap(-3)).toBe('-3.0 pts')
    expect(formatGap(null)).toBe('n/a')
  })
})

const countsArb = fc.record({
  taps: fc.nat({ max: 500 }),
  opens: fc.nat({ max: 500 }),
  signups: fc.nat({ max: 200 }),
  day1: fc.nat({ max: 200 }),
})
const sourceWeekArb = countsArb.map(({ taps, opens, signups, day1 }) =>
  sw(taps, opens, signups, Math.min(day1, signups)),
)
const sourcesArb = fc.record(
  Object.fromEntries(ACQUISITION_LABELS.map((l) => [l, sourceWeekArb])) as Record<
    AcquisitionLabel,
    fc.Arbitrary<SourceWeek>
  >,
)
const weeksArb = fc.array(fc.tuple(sourcesArb, fc.boolean()), { minLength: 0, maxLength: 6 }).map((rows) =>
  rows.map(([sources, complete], i) => {
    const start = new Date(Date.UTC(2026, 8, 28) - i * 7 * 86_400_000).toISOString().slice(0, 10)
    return { weekStart: start, complete, sources }
  }),
)

describe('Feature: GlyphCity rebrand, Property 11: silence verdict reads only complete creator and non-creator weeks', () => {
  it('proposes only when every read week trails on the named metric', () => {
    fc.assert(
      fc.property(weeksArb, (weeks) => {
        const v = silenceVerdict(weeks)
        if (v.status !== 'propose_next_cue') return
        expect(SILENCE_METRICS).toContain(v.metric)
        for (const start of v.weeks) {
          const w = weeks.find((x) => x.weekStart === start)!
          expect(w.complete).toBe(true)
          expect(gapPoints(w, v.metric!)!).toBeGreaterThan(SILENCE_MARGIN_POINTS)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('is unchanged by open weeks and by accounts from before tracking', () => {
    fc.assert(
      fc.property(weeksArb, sourceWeekArb, (weeks, noise) => {
        const before = silenceVerdict(weeks)
        const changed = weeks.map((w) =>
          w.complete
            ? { ...w, sources: { ...w.sources, unknown: noise } }
            : { ...w, sources: { ...w.sources, creator: noise, organic: noise } },
        )
        expect(silenceVerdict(changed)).toEqual(before)
      }),
      { numRuns: 200 },
    )
  })

  it('every funnel event is counted in the pooled side', () => {
    fc.assert(
      fc.property(sourcesArb, (sources) => {
        const pooled = nonCreator({ weekStart: '2026-09-28', complete: true, sources })
        for (const e of FUNNEL_EVENTS) {
          expect(pooled.events[e]).toBe(sources.share.events[e] + sources.qr.events[e] + sources.organic.events[e])
        }
      }),
      { numRuns: 100 },
    )
  })
})
