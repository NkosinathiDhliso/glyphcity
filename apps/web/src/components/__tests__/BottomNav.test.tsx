// @vitest-environment jsdom
/**
 * BottomNav Map tab carries the Logo_Mark (glyphcity-rebrand R5.8) and keeps
 * its accessible name and the reselect toggle (map-carousel rule).
 *
 * **Validates: Requirements 5.8**
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BottomNav } from '../BottomNav'

afterEach(cleanup)

describe('BottomNav Map tab', () => {
  it('renders the Logo_Mark at 13px and keeps its accessible name', () => {
    render(<BottomNav active="map" onNavigate={vi.fn()} />)
    const tab = screen.getByRole('button', { name: 'nav.map' })
    const mark = tab.querySelector('[data-testid="logo-mark"]')
    expect(mark).not.toBeNull()
    expect(mark?.getAttribute('width')).toBe('13')
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    // The other tabs keep their Lucide icons, not the mark.
    expect(screen.getByRole('button', { name: 'nav.profile' }).querySelector('[data-testid="logo-mark"]')).toBeNull()
  })

  it('still fires onReselect when the active Map tab is tapped', () => {
    const onReselect = vi.fn()
    const onNavigate = vi.fn()
    render(<BottomNav active="map" onNavigate={onNavigate} onReselect={onReselect} />)
    fireEvent.click(screen.getByRole('button', { name: 'nav.map' }))
    expect(onReselect).toHaveBeenCalledWith('map')
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
