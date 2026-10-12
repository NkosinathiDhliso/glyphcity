// @vitest-environment jsdom
import { DEFAULT_ORDER_MODE } from '@area-code/shared/constants/ranking'
import { useErrorStore } from '@area-code/shared/stores/errorStore'
import { useMapStore } from '@area-code/shared/stores/mapStore'
import { useSelectionStore } from '@area-code/shared/stores/selectionStore'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { Node, NodeState, User } from '@area-code/shared/types'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UseCarouselSelectionResult } from '../../hooks/useCarouselSelection'
import type { VenueCardVM } from '../../lib/carouselConstants'
import { PeekCarousel } from '../PeekCarousel'

/**
 * Feature: Vibe order toggle, the Order_Control on the Browse_Mode strip
 * (R2.1 to R2.4, R5.4). The control shows only in Browse_Mode with cards,
 * re-ranks without touching the camera, scope or Active_Venue, and saves a
 * signed-in choice with one PATCH.
 */

const apiMock = vi.hoisted(() => ({ patch: vi.fn() }))
vi.mock('@area-code/shared/lib/api', () => ({ api: apiMock }))
vi.mock('@area-code/shared/components/BottomSheet', () => ({
  BottomSheet: ({ children }) => <div data-bottomsheet>{children}</div>,
}))
vi.mock('../NodeDetailContent', () => ({
  NodeDetailContent: () => <div data-node-detail-stub />,
}))

const camera = { flyTo: vi.fn(), easeTo: vi.fn(), jumpTo: vi.fn(), setZoom: vi.fn(), setCenter: vi.fn() }

afterEach(cleanup)
beforeEach(() => {
  apiMock.patch.mockReset()
  apiMock.patch.mockResolvedValue({})
  Object.values(camera).forEach((fn) => fn.mockReset())
  useUserStore.setState({ user: null, orderMode: DEFAULT_ORDER_MODE })
  useErrorStore.setState({ error: null })
  useMapStore.setState({
    nodes: {
      a: { id: 'a', category: 'nightlife' } as Node,
      b: { id: 'b', category: 'nightlife' } as Node,
    },
    mapInstance: camera as never,
  })
  useSelectionStore.setState({
    activeVenueId: 'a',
    mode: 'browse',
    carouselOrder: ['a', 'b'],
    openedFromFocus: false,
    lastVenueId: null,
  })
})

function vm(id: string): VenueCardVM {
  return {
    id,
    name: `Venue ${id}`,
    liveCheckInCount: 5,
    pulseState: 'buzzing',
    archetypeId: 'archetype-festival-spirit',
    isFirstIn: false,
  }
}

function makeSelection(over: Partial<UseCarouselSelectionResult> = {}): UseCarouselSelectionResult {
  return {
    mode: 'browse',
    activeVenueId: 'a',
    activeVenue: { id: 'a' } as Node,
    activeVenueVM: vm('a'),
    carouselOrderVMs: [vm('a'), vm('b')],
    openedFromFocus: false,
    onSwipe: vi.fn(),
    selectVenue: vi.fn(),
    enterCommit: vi.fn(),
    enterBrowse: vi.fn(),
    commitZoom: vi.fn(),
    nearbyCount: 1,
    dismiss: vi.fn(),
    setSwipeInProgress: vi.fn(),
    browseScope: 'recommended',
    showRecommended: vi.fn(),
    recomputeOrder: vi.fn(),
    notifyViewportChanged: vi.fn(),
    ...over,
  } as UseCarouselSelectionResult
}

function renderCarousel(selection: UseCarouselSelectionResult) {
  return render(
    <PeekCarousel
      selection={selection}
      rewards={[]}
      pulseScore={30}
      state={'buzzing' as NodeState}
      onCheckIn={vi.fn()}
      onSignIn={vi.fn()}
    />,
  )
}

function signIn(): void {
  useUserStore.setState({ user: { id: 'u-1', tier: 'local', totalCheckIns: 0 } as User })
}

async function choose(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: label }))
  })
}

describe('OrderModeControl visibility', () => {
  it('renders in Browse_Mode with cards, named and with the active option pressed', () => {
    renderCarousel(makeSelection())

    const group = screen.getByRole('group', { name: 'Order venues by' })
    expect(group).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Busiest' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'My crowd' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('shares the row with "Back to recommended" in area scope', () => {
    const { container } = renderCarousel(makeSelection({ browseScope: 'area' }))

    const cue = container.querySelector('[data-back-to-recommended]')!
    const control = container.querySelector('[data-order-mode-control]')!
    expect(cue.parentElement).toBe(control.parentElement)
    expect(cue.className).toContain('min-h-11')
  })

  it('is hidden in the empty Browse_Mode state', () => {
    const { container } = renderCarousel(makeSelection({ carouselOrderVMs: [], browseScope: 'area' }))

    expect(container.querySelector('[data-browse-empty]')).toBeTruthy()
    expect(container.querySelector('[data-order-mode-control]')).toBeNull()
  })

  it.each(['constellation', 'commit'] as const)('is hidden in %s mode', (mode) => {
    const { container } = renderCarousel(makeSelection({ mode }))

    expect(container.querySelector('[data-order-mode-control]')).toBeNull()
  })
})

describe('OrderModeControl selection', () => {
  it('re-ranks once and keeps the camera, scope and Active_Venue', async () => {
    const selection = makeSelection()
    renderCarousel(selection)

    await choose('My crowd')

    expect(useUserStore.getState().orderMode).toBe('crowd')
    expect(selection.recomputeOrder).toHaveBeenCalledTimes(1)
    expect(selection.selectVenue).not.toHaveBeenCalled()
    expect(selection.notifyViewportChanged).not.toHaveBeenCalled()
    expect(selection.showRecommended).not.toHaveBeenCalled()
    expect(useSelectionStore.getState().activeVenueId).toBe('a')
    Object.values(camera).forEach((fn) => expect(fn).not.toHaveBeenCalled())
  })

  it('does nothing when the active option is tapped again', async () => {
    const selection = makeSelection()
    renderCarousel(selection)

    await choose('Busiest')

    expect(selection.recomputeOrder).not.toHaveBeenCalled()
    expect(apiMock.patch).not.toHaveBeenCalled()
  })

  it('sends no PATCH while logged out', async () => {
    renderCarousel(makeSelection())

    await choose('My crowd')

    expect(apiMock.patch).not.toHaveBeenCalled()
  })

  it('sends one PATCH when signed in', async () => {
    signIn()
    renderCarousel(makeSelection())

    await choose('My crowd')

    expect(apiMock.patch).toHaveBeenCalledTimes(1)
    expect(apiMock.patch).toHaveBeenCalledWith('/v1/users/me', { orderMode: 'crowd' })
  })

  it('keeps the choice and shows the error when the save fails', async () => {
    signIn()
    apiMock.patch.mockRejectedValue(new Error('offline'))
    renderCarousel(makeSelection())

    await choose('My crowd')

    expect(useUserStore.getState().orderMode).toBe('crowd')
    expect(useErrorStore.getState().error).toBe("Couldn't save your order choice")
    expect(screen.getByRole('button', { name: 'My crowd' }).getAttribute('aria-pressed')).toBe('true')
  })
})
