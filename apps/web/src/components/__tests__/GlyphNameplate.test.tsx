// @vitest-environment jsdom
/**
 * Glyph_Name and category word on the selected VenueCard and in
 * NodeDetailContent (glyphcity-rebrand task 3.1).
 *
 * Validates: Requirements 3.1, 3.5
 */
import { ARCHETYPE_CATALOG } from '@area-code/shared/constants/archetype-catalog'
import { useConsumerAuthStore } from '@area-code/shared/stores/consumerAuthStore'
import { useLocationStore } from '@area-code/shared/stores/locationStore'
import { useMapStore } from '@area-code/shared/stores/mapStore'
import { usePresenceStore } from '@area-code/shared/stores/presenceStore'
import type { Node } from '@area-code/shared/types'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { VenueCardVM } from '../../lib/carouselConstants'
import { NodeDetailContent } from '../NodeDetailContent'
import { VenueCard } from '../VenueCard'

vi.mock('@area-code/shared/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('../CrowdVibeSection', () => ({ CrowdVibeSection: () => <div data-crowd-vibe-stub /> }))
vi.mock('../QrScannerSheet', () => ({ QrScannerSheet: () => <div data-qr-stub /> }))
vi.mock('../DirectionsSheet', () => ({ DirectionsSheet: () => <div data-directions-stub /> }))

const ROYAL = 'archetype-township-royal'

function makeVM(archetypeId = ROYAL): VenueCardVM {
  return {
    id: 'node-1',
    name: 'Fox Street Yard',
    liveCheckInCount: 41,
    pulseState: 'popping',
    archetypeId,
    isFirstIn: false,
  }
}

const NODE = {
  id: 'node-1',
  slug: 'fox-street-yard',
  name: 'Fox Street Yard',
  category: 'nightlife',
  lat: -26.2,
  lng: 28.04,
  claimStatus: 'claimed',
} as Node

function renderDetail(archetypeId: string) {
  useMapStore.setState({ archetypeIds: { [NODE.id]: archetypeId } })
  return render(
    <NodeDetailContent
      node={NODE}
      rewards={[]}
      pulseScore={80}
      state="popping"
      onCheckIn={vi.fn()}
      onSignIn={vi.fn()}
    />,
  )
}

beforeEach(() => {
  usePresenceStore.getState().clear()
  useLocationStore.setState({ geoStatus: 'idle' })
  useConsumerAuthStore.setState({ isAuthenticated: true })
  useMapStore.setState({ archetypeIds: {} })
})

afterEach(cleanup)

describe('VenueCard glyph name and category word', () => {
  it('shows the Glyph_Name and category word on the selected card', () => {
    const { container } = render(<VenueCard vm={makeVM()} category="nightlife" isActive />)
    expect(container.querySelector('[data-glyph-name]')?.textContent).toContain('The Township Royal')
    expect(container.querySelector('[data-category-word]')?.textContent).toBe('Nightlife')
    const label = container.querySelector('[data-venue-card]')?.getAttribute('aria-label') ?? ''
    expect(label).toContain('Nightlife')
    expect(label).toContain('The Township Royal')
  })

  it('shows the category word but not the Glyph_Name on an unselected card', () => {
    const { container } = render(<VenueCard vm={makeVM()} category="food" />)
    expect(container.querySelector('[data-glyph-name]')).toBeNull()
    expect(container.textContent).not.toContain('The Township Royal')
    expect(container.querySelector('[data-category-word]')?.textContent).toBe('Food')
  })

  it('omits the Glyph_Name line for an unknown archetype', () => {
    const { container } = render(<VenueCard vm={makeVM('archetype-none')} category="nightlife" isActive />)
    expect(container.querySelector('[data-glyph-name]')).toBeNull()
  })
})

describe('NodeDetailContent glyph name and category word', () => {
  it('shows the Glyph_Name and the category word', () => {
    const { container } = renderDetail(ROYAL)
    expect(container.querySelector('[data-glyph-name]')?.textContent).toBe('The Township Royal')
    expect(container.querySelector('[data-category-word]')?.textContent).toBe('Nightlife')
  })

  it('omits the Glyph_Name line for an unknown archetype', () => {
    const { container } = renderDetail('archetype-none')
    expect(container.querySelector('[data-glyph-name]')).toBeNull()
  })
})

describe('no glyph description renders (R3.1)', () => {
  it('never renders a catalog description on the card or in detail', () => {
    for (const archetype of ARCHETYPE_CATALOG) {
      const card = render(<VenueCard vm={makeVM(archetype.id)} category="nightlife" isActive />)
      expect(card.container.innerHTML).not.toContain(archetype.description)
      card.unmount()

      const detail = renderDetail(archetype.id)
      expect(detail.container.textContent).toContain(archetype.name)
      expect(detail.container.innerHTML).not.toContain(archetype.description)
      detail.unmount()
    }
  })
})
