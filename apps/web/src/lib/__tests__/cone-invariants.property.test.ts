// @vitest-environment jsdom
/**
 * Feature: GlyphCity rebrand, Property 1: cone invariance
 *
 * For every Pulse_State and category, the beam and glyph metrics produced by the
 * real marker builder (buildMarkerElement -> ensureBeamLayers) equal the pinned
 * tables below. Tables are hardcoded literals; a failure means a Cone_Invariant
 * changed, which needs its own spec.
 *
 * **Validates: Requirements 4.1, 4.2**
 */
import type { Node, NodeCategory, NodeState } from '@area-code/shared/types'
import { cleanup, render } from '@testing-library/react'
import fc from 'fast-check'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { ArchetypeGlyph } from '../../components/ArchetypeGlyph'
import { buildMarkerElement, getGlyphSize } from '../../hooks/useMapMarkers'
import { getCategoryColour } from '../mapHelpers'

const STATES: NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']
const CATEGORIES: NodeCategory[] = ['food', 'coffee', 'nightlife', 'retail', 'fitness', 'arts']

const PINNED_BEAM_HEIGHT: Record<NodeState, number> = {
  dormant: 62,
  quiet: 78,
  active: 98,
  buzzing: 128,
  popping: 158,
}
const PINNED_CONE_TOP: Record<NodeState, number> = { dormant: 16, quiet: 20, active: 28, buzzing: 36, popping: 48 }
const PINNED_OPACITY: Record<NodeState, string> = {
  dormant: '0.35',
  quiet: '0.5',
  active: '0.65',
  buzzing: '0.8',
  popping: '0.95',
}
const PINNED_GLYPH_SIZE: Record<NodeState, number> = { dormant: 18, quiet: 22, active: 28, buzzing: 36, popping: 46 }
const PINNED_HALO_OPACITY: Record<NodeState, string> = {
  dormant: '0.12',
  quiet: '0.2',
  active: '0.3',
  buzzing: '0.4',
  popping: '0.5',
}
const PINNED_CATEGORY_HEX: Record<NodeCategory, string> = {
  food: '#ff6b6b',
  coffee: '#a0785a',
  nightlife: '#3B7DD8',
  retail: '#38bdf8',
  fitness: '#22d3a0',
  arts: '#ff9f43',
}
const PINNED_CLIP = 'polygon(4% 0%, 96% 0%, 50% 100%)'

function pinnedGradient(hex: string): string {
  return (
    `linear-gradient(to top, ${hex} 0%, ${hex}ee 6%, ${hex}cc 18%, ${hex}88 38%, ` +
    `${hex}44 62%, ${hex}18 85%, transparent 100%)`
  )
}

/** jsdom rewrites hex stops to rgb()/rgba(); run the pinned value through the same CSSOM. */
function cssomBackground(value: string): string {
  const probe = document.createElement('div')
  probe.style.background = value
  return probe.style.background
}

function pinnedOutline(size: number): string {
  return String(Math.max(1, Math.round(Math.max(8, size) * 0.12)))
}

function layer(root: HTMLElement, name: string): HTMLElement {
  const el = root.querySelector(`[data-layer="${name}"]`) as HTMLElement | null
  expect(el).not.toBeNull()
  return el!
}

const noop = (): void => {}

afterEach(() => {
  cleanup()
})

describe('Feature: GlyphCity rebrand, Property 1: cone invariance', () => {
  it('built marker beam and glyph metrics equal the pinned tables for every state and category', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATES), fc.constantFrom(...CATEGORIES), (state, category) => {
        const colour = getCategoryColour(category)
        expect(colour).toBe(PINNED_CATEGORY_HEX[category])

        const glyphSize = getGlyphSize(state, 0)
        expect(glyphSize).toBe(PINNED_GLYPH_SIZE[state])

        const node = { id: `n-${state}-${category}`, category } as Node
        const el = buildMarkerElement(node, glyphSize, colour, state, 0, false, noop)

        const cone = layer(el, 'beam-cone')
        expect(cone.style.height).toBe(`${PINNED_BEAM_HEIGHT[state]}px`)
        expect(cone.style.width).toBe(`${PINNED_CONE_TOP[state]}px`)
        expect(cone.style.opacity).toBe(PINNED_OPACITY[state])
        expect(cone.style.clipPath).toBe(PINNED_CLIP)
        const expectedGradient = cssomBackground(pinnedGradient(PINNED_CATEGORY_HEX[category]))
        expect(expectedGradient).toContain('linear-gradient(to top,')
        expect(cone.style.background).toBe(expectedGradient)

        const wrapper = layer(el, 'glyph-wrapper')
        expect(wrapper.style.width).toBe(`${PINNED_GLYPH_SIZE[state]}px`)
        expect(wrapper.style.height).toBe(`${PINNED_GLYPH_SIZE[state]}px`)

        expect(layer(el, 'halo').style.opacity).toBe(PINNED_HALO_OPACITY[state])
      }),
      { numRuns: 100 },
    )
  })

  it('rendered glyph outline width follows the pinned rule for any size and state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...CATEGORIES),
        fc.oneof(
          fc.integer({ min: 0, max: 120 }),
          fc.constantFrom(...STATES).map((s) => PINNED_GLYPH_SIZE[s]),
        ),
        (state, category, size) => {
          const { container, unmount } = render(
            createElement(ArchetypeGlyph, { archetypeId: 'archetype-eclectic', pulseState: state, category, size }),
          )
          const outlineSvg = container.querySelector('svg')
          expect(outlineSvg).not.toBeNull()
          expect(outlineSvg!.style.strokeWidth).toBe(pinnedOutline(size))
          unmount()
        },
      ),
      { numRuns: 100 },
    )
  })
})
