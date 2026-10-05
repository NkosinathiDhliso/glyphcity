import { describe, expect, it } from 'vitest'

import { ARCHETYPE_CATALOG } from '../../constants/archetype-catalog'
import { accessibleNodeName, type Translate } from '../accessibleNodeName'

const t: Translate = (_key, defaultValue) => defaultValue

describe('accessibleNodeName', () => {
  it('names venue, category, glyph, state and count (design example)', () => {
    const name = accessibleNodeName(
      { name: 'Fox Street Yard', category: 'nightlife' },
      'archetype-township-royal',
      'popping',
      41,
      t,
    )
    expect(name).toBe('Fox Street Yard, Nightlife, The Township Royal, Very busy, 41 here now')
  })

  it('reads the invite for a dormant venue with nobody there', () => {
    const name = accessibleNodeName({ name: 'Marula Lounge', category: 'food' }, 'archetype-eclectic', 'dormant', 0, t)
    expect(name).toBe('Marula Lounge, Food, The Eclectic, Be the first in')
  })

  it('omits the glyph segment for an unknown or missing archetype', () => {
    const venue = { name: 'Kopi', category: 'coffee' } as const
    expect(accessibleNodeName(venue, 'archetype-nope', 'active', 3, t)).toBe('Kopi, Coffee, A little busy, 3 here now')
    expect(accessibleNodeName(venue, null, 'quiet', 0, t)).toBe('Kopi, Coffee, Quiet')
  })

  it('zero live presence with residual pulse reads Quiet, never a busier band, and no count', () => {
    const venue = { name: 'Yard', category: 'nightlife' } as const
    for (const state of ['quiet', 'active', 'buzzing', 'popping'] as const) {
      expect(accessibleNodeName(venue, null, state, 0, t)).toBe('Yard, Nightlife, Quiet')
    }
  })

  it('presence on a dormant pulse reads Quiet without the count or invite', () => {
    const name = accessibleNodeName({ name: 'Yard', category: 'arts' }, null, 'dormant', 2, t)
    expect(name).toBe('Yard, Arts, Quiet')
  })

  it('translates category, state and count through t', () => {
    const fr: Translate = (key) => `<${key}>`
    const name = accessibleNodeName({ name: 'Yard', category: 'retail' }, null, 'buzzing', 5, fr)
    expect(name).toBe('Yard, <map.categories.retail>, <state.busy>, 5 <venueCard.hereNow>')
  })

  it('never includes an archetype description', () => {
    for (const a of ARCHETYPE_CATALOG) {
      const name = accessibleNodeName({ name: 'V', category: 'food' }, a.id, 'popping', 9, t)
      expect(name).toContain(a.name)
      expect(name).not.toContain(a.description)
    }
  })
})
