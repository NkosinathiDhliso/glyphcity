import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { ARCHETYPE_CATALOG, getGlyphName } from '../../constants/archetype-catalog'
import { categoryLabel, categoryLabelKey, NODE_CATEGORIES } from '../../constants/node-categories'
import { FIRST_IN_KEY, PLAIN_SCALE_EN, stateLabelKey, type StateLabelKey } from '../../constants/state-labels'
import type { NodeState } from '../../types'
import { accessibleNodeName, type Translate } from '../accessibleNodeName'

/**
 * Feature: GlyphCity rebrand, Property 5: accessible name completeness
 *
 * **Validates: Requirements 3.6**
 *
 * Parsing choice: the venue name is left unconstrained (it may contain ", "
 * or a Plain_Scale word), so the result is parsed positionally. The output
 * must start with `${venueName}, `; everything after that prefix is the
 * generated tail, split on ", " into category, optional glyph, state, and
 * optional count. All segment assertions run on the tail only, so a venue
 * named "Busy, Very busy" cannot satisfy or break them.
 */

const STATES: readonly NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']
const CATALOG_IDS = ARCHETYPE_CATALOG.map((a) => a.id)
const CATALOG_NAMES = ARCHETYPE_CATALOG.map((a) => a.name)
const RETIRED_WORDS = ['popping', 'buzzing', 'active', 'dormant']
const PLAIN_SCALE_KEYS = Object.keys(PLAIN_SCALE_EN) as StateLabelKey[]

const identityT: Translate = (_key, defaultValue) => defaultValue
const prefixT: Translate = (key, defaultValue) => `⟨${key}⟩${defaultValue}`

const venueNameArb = fc
  .oneof(
    fc.string({ minLength: 1, maxLength: 40 }),
    fc.constantFrom('Quiet', 'Busy, Very busy', 'Be the first in', 'The Firecracker', 'Popping, Dormant', 'Food'),
  )
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

const knownIdSet = new Set(CATALOG_IDS)
const archetypeArb = fc.oneof(
  fc.constantFrom(...CATALOG_IDS),
  fc.constantFrom<string | null | undefined>(null, undefined, '', 'archetype-nope'),
  fc.string({ maxLength: 30 }).filter((s) => !knownIdSet.has(s)),
)

const translatorArb = fc.constantFrom({ label: 'identity', t: identityT }, { label: 'prefix', t: prefixT })

/** The documented zero-live rule from `presenceStateKey`. */
function expectedStateKey(state: NodeState, live: number): StateLabelKey {
  if (live <= 0) return state === 'dormant' ? FIRST_IN_KEY : stateLabelKey('quiet')
  return stateLabelKey(state === 'dormant' ? 'quiet' : state)
}

/** Strip a prefixing translator's `⟨key⟩` so retired-word checks see the bare word. */
function bare(segment: string): string {
  return segment.replace(/^⟨[^⟩]*⟩/, '')
}

function tailOf(output: string, venueName: string): string {
  expect(output.startsWith(`${venueName}, `)).toBe(true)
  return output.slice(venueName.length + 2)
}

/** Run `fn` with every catalog description replaced by a per-run sentinel, then restore. */
function withSentinelDescriptions<T>(base: string, fn: (sentinels: string[]) => T): T {
  const originals = ARCHETYPE_CATALOG.map((a) => a.description)
  const sentinels = ARCHETYPE_CATALOG.map((_, i) => `${base}-${i}`)
  ARCHETYPE_CATALOG.forEach((a, i) => {
    a.description = sentinels[i]
  })
  try {
    return fn(sentinels)
  } finally {
    ARCHETYPE_CATALOG.forEach((a, i) => {
      a.description = originals[i]
    })
  }
}

describe('Feature: GlyphCity rebrand, Property 5: accessible name completeness', () => {
  it('names venue, category, glyph, one state word or invite, and never a description', () => {
    fc.assert(
      fc.property(
        venueNameArb,
        fc.constantFrom(...NODE_CATEGORIES.map((c) => c.value)),
        archetypeArb,
        fc.constantFrom(...STATES),
        fc.integer({ min: 0, max: 5000 }),
        translatorArb,
        fc.uuid(),
        (venueName, category, archetypeId, state, live, { t }, sentinelBase) => {
          const node = { name: venueName, category }
          const output = accessibleNodeName(node, archetypeId, state, live, t)
          const tail = tailOf(output, venueName)
          const segments = tail.split(', ')

          // Category word, routed through t.
          const categorySegment = segments[0]
          expect(categorySegment).toContain(categoryLabel(category))
          expect(categorySegment).toBe(t(categoryLabelKey(category), categoryLabel(category)))

          // Glyph_Name for a known archetype; no catalog name otherwise.
          const glyphName = archetypeId ? getGlyphName(archetypeId) : undefined
          if (archetypeId && knownIdSet.has(archetypeId)) {
            expect(glyphName).toBeDefined()
            expect(segments[1]).toBe(glyphName)
          } else {
            for (const name of CATALOG_NAMES) expect(tail).not.toContain(name)
          }

          // Exactly one Plain_Scale segment, matching the zero-live rule.
          const plainSegments = PLAIN_SCALE_KEYS.map((k) => t(k, PLAIN_SCALE_EN[k]))
          const stateMatches = segments.filter((s) => plainSegments.includes(s))
          const wantKey = expectedStateKey(state, live)
          expect(stateMatches).toEqual([t(wantKey, PLAIN_SCALE_EN[wantKey])])
          const stateIndex = glyphName ? 2 : 1
          expect(segments[stateIndex]).toBe(t(wantKey, PLAIN_SCALE_EN[wantKey]))

          // Count segment iff live > 0 and state is not dormant.
          const wantCount = live > 0 && state !== 'dormant'
          const countSegment = `${live} ${t('venueCard.hereNow', 'here now')}`
          expect(segments.length).toBe(stateIndex + 1 + (wantCount ? 1 : 0))
          if (wantCount) expect(segments[stateIndex + 1]).toBe(countSegment)

          // No retired word as a segment.
          for (const s of segments) expect(RETIRED_WORDS).not.toContain(bare(s).toLowerCase())

          // No real description, and none when descriptions become sentinels.
          for (const a of ARCHETYPE_CATALOG) expect(tail).not.toContain(a.description)
          withSentinelDescriptions(sentinelBase, (sentinels) => {
            const swapped = accessibleNodeName(node, archetypeId, state, live, t)
            expect(swapped).toBe(output)
            for (const s of sentinels) expect(swapped).not.toContain(s)
          })
        },
      ),
      { numRuns: 200 },
    )
  })
})
