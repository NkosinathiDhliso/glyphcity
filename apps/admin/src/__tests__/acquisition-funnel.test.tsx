// @vitest-environment jsdom
/**
 * Admin funnel by source (GlyphCity rebrand R11.2): the screen reads
 * `/v1/admin/acquisition-funnel`, shows the verdict, and opens on the most
 * recent complete week with one row per source plus the non-creator pool.
 */
import { ACQUISITION_LABELS } from '@area-code/shared/constants/attribution'
import { emptySourceWeek, type AcquisitionFunnelPayload, type FunnelWeek } from '@area-code/shared/lib/silenceRule'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('@area-code/shared/lib/api', () => ({ api: { get: getMock } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { AcquisitionFunnel } from '../screens/AcquisitionFunnel'

function week(weekStart: string, complete: boolean, creatorTaps: number): FunnelWeek {
  const sources = Object.fromEntries(ACQUISITION_LABELS.map((l) => [l, emptySourceWeek()])) as FunnelWeek['sources']
  sources.creator.events.venue_selected = creatorTaps
  sources.creator.events.venue_open = creatorTaps / 2
  return { weekStart, complete, sources }
}

const payload: AcquisitionFunnelPayload = {
  weeks: [week('2026-10-05', false, 40), week('2026-09-28', true, 20)],
  verdict: { status: 'hold', metric: null, weeks: ['2026-09-28', '2026-09-21'] },
  generatedAt: '2026-10-07T12:00:00.000Z',
  cacheMinutes: 30,
}

afterEach(() => getMock.mockReset())

describe('AcquisitionFunnel', () => {
  it('loads the 8-week funnel and shows the verdict', async () => {
    getMock.mockResolvedValue(payload)
    render(<AcquisitionFunnel />)
    await screen.findByText('admin.acquisition.verdict.hold.title')
    expect(getMock).toHaveBeenCalledWith('/v1/admin/acquisition-funnel?weeks=8')
  })

  it('opens on the most recent complete week, with every source and the pool', async () => {
    getMock.mockResolvedValue(payload)
    render(<AcquisitionFunnel />)
    const creator = await screen.findByRole('rowheader', { name: 'admin.acquisition.source.creator' })
    const row = creator.closest('tr')!
    expect(within(row).getByText('20')).toBeTruthy()
    expect(within(row).getByText('50.0%')).toBeTruthy()
    for (const key of ['share', 'qr', 'organic', 'nonCreator', 'unknown']) {
      expect(screen.getByRole('rowheader', { name: `admin.acquisition.source.${key}` })).toBeTruthy()
    }
  })

  it('reloads for a new window', async () => {
    getMock.mockResolvedValue(payload)
    render(<AcquisitionFunnel />)
    await screen.findByText('admin.acquisition.verdict.hold.title')
    fireEvent.click(screen.getByRole('button', { name: '12w' }))
    await waitFor(() => expect(getMock).toHaveBeenLastCalledWith('/v1/admin/acquisition-funnel?weeks=12'))
  })

  it('offers a retry when the first load fails', async () => {
    getMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(payload)
    render(<AcquisitionFunnel />)
    fireEvent.click(await screen.findByRole('button', { name: 'admin.acquisition.retry' }))
    await screen.findByText('admin.acquisition.verdict.hold.title')
  })
})
