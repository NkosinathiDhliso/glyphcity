/**
 * Admin funnel by Acquisition_Source (GlyphCity rebrand R11.2): reads the
 * usage metric per event and label, sums days into ISO weeks, joins the
 * retention split, and applies the decision rule.
 */
import { ACQUISITION_LABELS } from '@area-code/shared/constants/attribution'
import { FUNNEL_EVENTS } from '@area-code/shared/lib/silenceRule'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn(), computeRetention: vi.fn() }))

vi.mock('../../../shared/monitoring/cloudwatch.js', () => ({
  getCloudWatchClient: async () => ({ send: mocks.send }),
}))
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  GetMetricDataCommand: class {
    constructor(public input: unknown) {}
  },
}))
vi.mock('../retention.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../retention.js')>()),
  computeRetention: mocks.computeRetention,
}))
vi.mock('../../auth/repository.js', () => ({ getUserById: vi.fn() }))

import {
  buildQueries,
  clearAcquisitionFunnelCache,
  computeAcquisitionFunnel,
  isCompleteWeek,
  weekStarts,
} from '../acquisition-funnel.js'

// Wednesday 2026-10-07 12:00 UTC: the current week starts Monday 2026-10-05.
const NOW = new Date('2026-10-07T12:00:00.000Z')

function bySource(signups: Record<string, [number, number]>) {
  return Object.fromEntries(
    ACQUISITION_LABELS.map((l) => [l, { signups: signups[l]?.[0] ?? 0, d1: signups[l]?.[1] ?? 0 }]),
  )
}

beforeEach(() => {
  clearAcquisitionFunnelCache()
  mocks.send.mockReset()
  mocks.computeRetention.mockReset()
})

describe('acquisition funnel helpers', () => {
  it('asks for every funnel event under every label, with the metric the events service writes', () => {
    const { queries, keys } = buildQueries()
    expect(queries).toHaveLength(FUNNEL_EVENTS.length * ACQUISITION_LABELS.length)
    const first = queries[0]!.MetricStat!
    expect(first.Metric!.Namespace).toBe('AreaCode/Usage')
    expect(first.Metric!.MetricName).toBe('Count')
    expect(first.Period).toBe(86_400)
    expect(first.Stat).toBe('Sum')
    expect(new Set([...keys.values()].map((k) => `${k.event}:${k.label}`)).size).toBe(queries.length)
  })

  it('lists week starts oldest to newest, ending with the current Monday', () => {
    expect(weekStarts(3, NOW)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05'])
  })

  it('closes a week one day after it ends, so Sunday signups get their Day 1', () => {
    expect(isCompleteWeek('2026-09-28', new Date('2026-10-05T23:59:59.000Z'))).toBe(false)
    expect(isCompleteWeek('2026-09-28', new Date('2026-10-06T00:00:00.000Z'))).toBe(true)
  })
})

describe('computeAcquisitionFunnel', () => {
  it('sums daily points into weeks per label and joins the retention split', async () => {
    const { keys } = buildQueries()
    const idOf = (event: string, label: string) =>
      [...keys.entries()].find(([, k]) => k.event === event && k.label === label)![0]
    mocks.send.mockResolvedValueOnce({
      MetricDataResults: [
        {
          Id: idOf('venue_selected', 'creator'),
          Timestamps: [new Date('2026-09-29T00:00:00Z'), new Date('2026-10-01T00:00:00Z')],
          Values: [4, 6],
        },
        { Id: idOf('venue_open', 'creator'), Timestamps: [new Date('2026-09-30T00:00:00Z')], Values: [8] },
        { Id: idOf('venue_open', 'organic'), Timestamps: [new Date('2026-10-06T00:00:00Z')], Values: [3] },
      ],
      NextToken: 'page-2',
    })
    mocks.send.mockResolvedValueOnce({
      MetricDataResults: [
        { Id: idOf('venue_selected', 'creator'), Timestamps: [new Date('2026-10-04T00:00:00Z')], Values: [5] },
      ],
    })
    mocks.computeRetention.mockResolvedValue({
      cohorts: [{ cohortWeekStart: '2026-09-28', bySource: bySource({ creator: [10, 4], organic: [20, 3] }) }],
    })

    const payload = await computeAcquisitionFunnel(3, NOW)

    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.computeRetention).toHaveBeenCalledWith(4)
    expect(payload.weeks.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-09-28', '2026-09-21'])
    const [current, last] = payload.weeks
    expect(current!.complete).toBe(false)
    expect(current!.sources.organic.events.venue_open).toBe(3)
    expect(last!.complete).toBe(true)
    expect(last!.sources.creator.events.venue_selected).toBe(15)
    expect(last!.sources.creator.events.venue_open).toBe(8)
    expect(last!.sources.creator).toMatchObject({ signups: 10, day1: 4 })
    expect(last!.sources.organic).toMatchObject({ signups: 20, day1: 3 })
    // The 2026-09-21 week has no non-creator numbers, so the rule cannot read it.
    expect(payload.verdict.status).toBe('not_enough_data')
  })

  it('caches per window', async () => {
    mocks.send.mockResolvedValue({ MetricDataResults: [] })
    mocks.computeRetention.mockResolvedValue({ cohorts: [] })
    await computeAcquisitionFunnel(4, NOW)
    await computeAcquisitionFunnel(4, NOW)
    await computeAcquisitionFunnel(8, NOW)
    expect(mocks.send).toHaveBeenCalledTimes(2)
  })
})
