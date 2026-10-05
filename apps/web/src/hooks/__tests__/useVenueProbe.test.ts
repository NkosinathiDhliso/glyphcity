// @vitest-environment jsdom
/**
 * `venue_probe` (GlyphCity rebrand R11.1): a detail opened and closed within
 * two seconds is a probe; a longer read is not.
 */
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }))
vi.mock('@area-code/shared/lib/usageEvents', () => ({ trackEvent: mocks.trackEvent }))

import { isVenueProbe, useVenueProbe } from '../useVenueProbe'

beforeEach(() => {
  vi.useFakeTimers()
  mocks.trackEvent.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('isVenueProbe', () => {
  it('is a probe under two seconds only', () => {
    expect(isVenueProbe(0, 1_999)).toBe(true)
    expect(isVenueProbe(0, 2_000)).toBe(false)
  })
})

describe('useVenueProbe', () => {
  it('emits venue_probe when the detail closes quickly', () => {
    const { unmount } = renderHook(() => useVenueProbe('node-1'))
    vi.advanceTimersByTime(800)
    unmount()
    expect(mocks.trackEvent).toHaveBeenCalledWith('venue_probe')
  })

  it('stays quiet after a real read', () => {
    const { unmount } = renderHook(() => useVenueProbe('node-1'))
    vi.advanceTimersByTime(6_000)
    unmount()
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('does nothing without a venue', () => {
    const { unmount } = renderHook(() => useVenueProbe(null))
    unmount()
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })
})
