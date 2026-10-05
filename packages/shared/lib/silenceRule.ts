/**
 * Silence measure (GlyphCity rebrand R11.2, R11.3). The app names glyphs and
 * never explains them; this module answers whether that still works for people
 * who never saw a creator video. One home for the funnel shape the admin
 * endpoint returns, the rates the admin view shows, and the decision rule in
 * `docs/decisions/glyphcity-rebrand.md` decision 10. Pure, no runtime
 * dependencies, so the backend and the admin app share it.
 */
import { ACQUISITION_LABELS, type AcquisitionLabel } from '../constants/attribution'
import type { UsageEventName } from '../constants/usage-events'

/** Decision 10: the gap, in percentage points, that counts as trailing. */
export const SILENCE_MARGIN_POINTS = 15

/** Decision 10: how many complete weeks in a row the gap must hold. */
export const SILENCE_CONSECUTIVE_WEEKS = 2

/** The usage events the funnel counts, in funnel order. */
export const FUNNEL_EVENTS = [
  'venue_selected',
  'venue_open',
  'venue_probe',
  'checkin_completed',
] as const satisfies readonly UsageEventName[]

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number]

/** One source's numbers for one week. */
export interface SourceWeek {
  /** Usage-event counts for the week. */
  events: Record<FunnelEvent, number>
  /** Accounts created that week with this source. */
  signups: number
  /** Of those, how many checked in within a day of signing up. */
  day1: number
}

export interface FunnelWeek {
  /** Monday of the ISO week, UTC, as YYYY-MM-DD. */
  weekStart: string
  /** True once the week and its Day 1 window have both closed. */
  complete: boolean
  sources: Record<AcquisitionLabel, SourceWeek>
}

export type SilenceMetric = 'mapToDetail' | 'day1'

export const SILENCE_METRICS: readonly SilenceMetric[] = ['mapToDetail', 'day1']

export interface SilenceVerdict {
  /** `propose_next_cue` means: put the glyph name on the browse card to the founder. */
  status: 'propose_next_cue' | 'hold' | 'not_enough_data'
  /** The metric that trailed, when the status is `propose_next_cue`. */
  metric: SilenceMetric | null
  /** The complete weeks the verdict read, most recent first. */
  weeks: string[]
}

export interface AcquisitionFunnelPayload {
  /** Most recent first. */
  weeks: FunnelWeek[]
  verdict: SilenceVerdict
  generatedAt: string
  cacheMinutes: number
}

/** Rates for one source-week. Null when the denominator is zero. */
export interface FunnelRates {
  /** Detail opens per venue tap. */
  mapToDetail: number | null
  /** Share of detail opens closed within two seconds. */
  probe: number | null
  /** Check-ins per detail open. */
  detailToCheckIn: number | null
  /** Share of the week's signups who checked in within a day. */
  day1: number | null
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

export function funnelRates(week: SourceWeek): FunnelRates {
  const { events } = week
  return {
    mapToDetail: ratio(events.venue_open, events.venue_selected),
    probe: ratio(events.venue_probe, events.venue_open),
    detailToCheckIn: ratio(events.checkin_completed, events.venue_open),
    day1: ratio(week.day1, week.signups),
  }
}

/** A rate as a one-decimal percentage, or `n/a` when there is no denominator. */
export function formatRate(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

/** A gap in points with its sign, or `n/a`. */
export function formatGap(points: number | null): string {
  if (points === null) return 'n/a'
  return `${points > 0 ? '+' : ''}${points.toFixed(1)} pts`
}

export function emptySourceWeek(): SourceWeek {
  const events = Object.fromEntries(FUNNEL_EVENTS.map((e) => [e, 0])) as Record<FunnelEvent, number>
  return { events, signups: 0, day1: 0 }
}

/** Sum source-weeks into one. */
export function sumSourceWeeks(parts: SourceWeek[]): SourceWeek {
  const total = emptySourceWeek()
  for (const part of parts) {
    for (const e of FUNNEL_EVENTS) total.events[e] += part.events[e]
    total.signups += part.signups
    total.day1 += part.day1
  }
  return total
}

/**
 * Everyone a creator did not bring: share, qr and organic. `unknown` sits on
 * neither side, since those accounts predate the source being recorded.
 */
export function nonCreator(week: FunnelWeek): SourceWeek {
  return sumSourceWeeks(
    ACQUISITION_LABELS.filter((l) => l !== 'creator' && l !== 'unknown').map((l) => week.sources[l]),
  )
}

/**
 * Creator rate minus non-creator rate in percentage points, to one decimal so
 * the verdict matches the number on screen. Null when either side has no data.
 */
export function gapPoints(week: FunnelWeek, metric: SilenceMetric): number | null {
  const creator = funnelRates(week.sources.creator)[metric]
  const others = funnelRates(nonCreator(week))[metric]
  if (creator === null || others === null) return null
  return Math.round((creator - others) * 1000) / 10
}

/**
 * Decision 10: IF non-creator users trail creator users by more than
 * `SILENCE_MARGIN_POINTS` on map-to-detail or Day 1 retention for
 * `SILENCE_CONSECUTIVE_WEEKS` consecutive complete weeks, THEN propose the next
 * cue. Reads only the most recent complete weeks; an open week never counts.
 */
export function silenceVerdict(weeks: FunnelWeek[]): SilenceVerdict {
  const recent = weeks
    .filter((w) => w.complete)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, SILENCE_CONSECUTIVE_WEEKS)
  const read = recent.map((w) => w.weekStart)
  if (recent.length < SILENCE_CONSECUTIVE_WEEKS) return { status: 'not_enough_data', metric: null, weeks: read }

  let measured = false
  for (const metric of SILENCE_METRICS) {
    const gaps = recent.map((w) => gapPoints(w, metric))
    if (gaps.some((g) => g === null)) continue
    measured = true
    if (gaps.every((g) => g! > SILENCE_MARGIN_POINTS)) {
      return { status: 'propose_next_cue', metric, weeks: read }
    }
  }
  return { status: measured ? 'hold' : 'not_enough_data', metric: null, weeks: read }
}
