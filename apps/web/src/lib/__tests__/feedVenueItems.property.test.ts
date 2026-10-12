/**
 * Feature: North star alignment, Property 3: every feed item has a node id.
 *
 * **Validates: Requirements 4.2**
 *
 * `keepVenueItems` is the gate the feed screen runs before rendering: an item
 * that cannot be tapped to a room on the map never reaches the list, and no
 * item with a venue is dropped.
 */
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { keepVenueItems } from '../feedEnrichment'

const itemArb = fc.record({
  id: fc.uuid(),
  node: fc.option(fc.record({ id: fc.oneof(fc.constant(''), fc.uuid()) }), { nil: undefined }),
})

describe('Feature: North star alignment, Property 3: feed items are rooms', () => {
  it('keeps exactly the items with a node id, in order', () => {
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 30 }), (items) => {
        const kept = keepVenueItems(items)

        for (const item of kept) expect(item.node.id.length).toBeGreaterThan(0)
        expect(kept).toEqual(items.filter((i) => Boolean(i.node?.id)))
      }),
      { numRuns: 200 },
    )
  })
})
