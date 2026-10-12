// @vitest-environment jsdom
/**
 * Every feed item is about a room and taps to it (north-star-alignment R4.2,
 * task 4.3). For each item type the row renders, at least one control focuses
 * that item's venue on the map, and nothing else is a target.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EnrichedFeedItem } from '../../lib/feedEnrichment'
import { FeedItemRow } from '../FeedItemRow'

const NODE = { id: 'node-ramonas', name: "Ramona's", slug: 'ramonas', category: 'nightlife' }

const ITEMS: EnrichedFeedItem[] = [
  {
    id: 'c1',
    feedType: 'checkin',
    checkedInAt: new Date().toISOString(),
    user: { id: 'u1', username: 'thabo', displayName: 'Thabo', avatarUrl: null, tier: 'local' },
    node: NODE,
    venuePulseState: 'buzzing',
    venueCheckInCount: 4,
    venueArchetypeId: null,
    friendStillPresent: true,
  },
  {
    id: 'g1',
    feedType: 'live_get',
    checkedInAt: new Date().toISOString(),
    node: NODE,
    venuePulseState: null,
    venueCheckInCount: 0,
    venueArchetypeId: null,
    friendStillPresent: false,
    getTitle: 'Free coffee',
  },
]

afterEach(() => {
  cleanup()
})

describe('FeedItemRow focus (R4.2)', () => {
  it.each(ITEMS.map((item) => [item.feedType, item] as const))('every %s control focuses its venue', (_, item) => {
    const onFocusVenue = vi.fn()
    render(<FeedItemRow item={item} onFocusVenue={onFocusVenue} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      onFocusVenue.mockClear()
      fireEvent.click(button)
      expect(onFocusVenue).toHaveBeenCalledWith(NODE.id)
    }
  })

  it('renders nothing for a check-in with no venue', () => {
    const { container } = render(<FeedItemRow item={{ ...ITEMS[0]!, node: undefined }} onFocusVenue={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})
