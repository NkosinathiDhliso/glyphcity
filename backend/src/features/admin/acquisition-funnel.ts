/**
 * Funnel split by Acquisition_Source (GlyphCity rebrand R11.2, R11.3).
 *
 * Source data:
 *   - Usage-event counts: the `AreaCode/Usage` EMF metric, per event and
 *     acquisition label, read with one paginated GetMetricData call at a daily
 *     period and summed into ISO weeks here.
 *   - Signups and Day 1: the retention cohorts (`retention.ts`), already split
 *     by source, so both halves of the decision rule read one definition.
 *
 * Cached for 30 minutes per window, like retention.
 */
import { ACQUISITION_LABELS, type AcquisitionLabel } from '@area-code/shared/constants/attribution'
import {
  FUNNEL_EVENTS,
  emptySourceWeek,
  silenceVerdict,
  type AcquisitionFunnelPayload,
  type FunnelEvent,
  type FunnelWeek,
} from '@area-code/shared/lib/silenceRule'
import type { MetricDataQuery } from '@aws-sdk/client-cloudwatch'

import { getCloudWatchClient } from '../../shared/monitoring/cloudwatch.js'
import { ACQUISITION_DIMENSION, EVENT_DIMENSION, METRIC_NAME, METRIC_NAMESPACE } from '../events/service.js'

import { computeRetention, isoWeekMonday } from './retention.js'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const CACHE_TTL_MS = 30 * 60 * 1000

const cache = new Map<number, { payload: AcquisitionFunnelPayload; expiresAt: number }>()

interface SeriesKey {
  event: FunnelEvent
  label: AcquisitionLabel
}

/** One query per event and label: 4 x 5 = 20, well under the 500 per call cap. */
export function buildQueries(): { queries: MetricDataQuery[]; keys: Map<string, SeriesKey> } {
  const queries: MetricDataQuery[] = []
  const keys = new Map<string, SeriesKey>()
  for (const event of FUNNEL_EVENTS) {
    for (const label of ACQUISITION_LABELS) {
      const id = `q${queries.length}`
      keys.set(id, { event, label })
      queries.push({
        Id: id,
        MetricStat: {
          Metric: {
            Namespace: METRIC_NAMESPACE,
            MetricName: METRIC_NAME,
            Dimensions: [
              { Name: EVENT_DIMENSION, Value: event },
              { Name: ACQUISITION_DIMENSION, Value: label },
            ],
          },
          Period: DAY_MS / 1000,
          Stat: 'Sum',
        },
      })
    }
  }
  return { queries, keys }
}

/** Week starts (Mondays, UTC) from oldest to newest, ending with the current week. */
export function weekStarts(weeks: number, now: Date): string[] {
  const current = Date.parse(isoWeekMonday(now))
  return Array.from({ length: weeks }, (_, i) => new Date(current - (weeks - 1 - i) * WEEK_MS)).map((d) =>
    d.toISOString().slice(0, 10),
  )
}

/** A week is complete once it and the Day 1 window of its last signup have closed. */
export function isCompleteWeek(weekStart: string, now: Date): boolean {
  return Date.parse(weekStart) + WEEK_MS + DAY_MS <= now.getTime()
}

function emptyWeeks(starts: string[], now: Date): Map<string, FunnelWeek> {
  return new Map(
    starts.map((weekStart) => [
      weekStart,
      {
        weekStart,
        complete: isCompleteWeek(weekStart, now),
        sources: Object.fromEntries(ACQUISITION_LABELS.map((l) => [l, emptySourceWeek()])) as FunnelWeek['sources'],
      },
    ]),
  )
}

async function addEventCounts(byWeek: Map<string, FunnelWeek>, start: Date, end: Date): Promise<void> {
  const { GetMetricDataCommand } = await import('@aws-sdk/client-cloudwatch')
  const client = await getCloudWatchClient()
  const { queries, keys } = buildQueries()
  let nextToken: string | undefined
  do {
    const result = await client.send(
      new GetMetricDataCommand({
        MetricDataQueries: queries,
        StartTime: start,
        EndTime: end,
        ...(nextToken ? { NextToken: nextToken } : {}),
      }),
    )
    for (const series of result.MetricDataResults ?? []) {
      const key = keys.get(series.Id ?? '')
      if (!key) continue
      const timestamps = series.Timestamps ?? []
      const values = series.Values ?? []
      timestamps.forEach((ts, i) => {
        const week = byWeek.get(isoWeekMonday(ts))
        if (week) week.sources[key.label].events[key.event] += values[i] ?? 0
      })
    }
    nextToken = result.NextToken
  } while (nextToken)
}

async function addSignups(byWeek: Map<string, FunnelWeek>, weeks: number): Promise<void> {
  // One extra week so the oldest shown week is a whole cohort, not a partial one.
  const retention = await computeRetention(weeks + 1)
  for (const cohort of retention.cohorts) {
    const week = byWeek.get(cohort.cohortWeekStart)
    if (!week) continue
    for (const label of ACQUISITION_LABELS) {
      week.sources[label].signups = cohort.bySource[label].signups
      week.sources[label].day1 = cohort.bySource[label].d1
    }
  }
}

export async function computeAcquisitionFunnel(weeks: number, now = new Date()): Promise<AcquisitionFunnelPayload> {
  const cached = cache.get(weeks)
  if (cached && cached.expiresAt > now.getTime()) return cached.payload

  const starts = weekStarts(weeks, now)
  const byWeek = emptyWeeks(starts, now)
  await Promise.all([addEventCounts(byWeek, new Date(starts[0]!), now), addSignups(byWeek, weeks)])

  const ordered = [...byWeek.values()].reverse()
  const payload: AcquisitionFunnelPayload = {
    weeks: ordered,
    verdict: silenceVerdict(ordered),
    generatedAt: now.toISOString(),
    cacheMinutes: CACHE_TTL_MS / 60_000,
  }
  cache.set(weeks, { payload, expiresAt: now.getTime() + CACHE_TTL_MS })
  return payload
}

export function clearAcquisitionFunnelCache(): void {
  cache.clear()
}
