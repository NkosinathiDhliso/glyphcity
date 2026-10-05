// @vitest-environment jsdom
/**
 * Feature: GlyphCity rebrand. Cone_Invariants pin (Requirements 4.1, 4.2, 4.3).
 *
 * Every value below is a hardcoded literal copied from the current source. A
 * failure here means a Cone_Invariant changed; that needs its own spec, not an
 * edit to this file.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { NODE_CATEGORY_HEX } from '@area-code/shared/constants/archetype-icons'
import type { NodeCategory } from '@area-code/shared/types'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { ArchetypeGlyph } from '../../components/ArchetypeGlyph'
import { GLYPH_SIZE, STATE_CONFIG } from '../../hooks/useMapMarkers'
import { PULSE_TEMPO } from '../carouselConstants'
import { getCategoryColour } from '../mapHelpers'
import { BEAM_HEIGHT, BEAM_OPACITY, CONE_CLIP, CONE_TOP, beamGradient } from '../markerBeam'

const CATEGORIES: NodeCategory[] = ['food', 'coffee', 'nightlife', 'retail', 'fitness', 'arts']

afterEach(() => {
  cleanup()
})

describe('Cone_Invariants: beam geometry (markerBeam.ts)', () => {
  it('pins BEAM_HEIGHT', () => {
    expect(BEAM_HEIGHT).toEqual({ dormant: 62, quiet: 78, active: 98, buzzing: 128, popping: 158 })
  })

  it('pins CONE_TOP', () => {
    expect(CONE_TOP).toEqual({ dormant: 16, quiet: 20, active: 28, buzzing: 36, popping: 48 })
  })

  it('pins CONE_CLIP', () => {
    expect(CONE_CLIP).toBe('polygon(4% 0%, 96% 0%, 50% 100%)')
  })

  it('pins BEAM_OPACITY', () => {
    expect(BEAM_OPACITY).toEqual({ dormant: 0.35, quiet: 0.5, active: 0.65, buzzing: 0.8, popping: 0.95 })
  })

  it('pins the beam gradient stops', () => {
    expect(beamGradient('#3b7dd8')).toBe(
      'linear-gradient(to top, #3b7dd8 0%, #3b7dd8ee 6%, #3b7dd8cc 18%, #3b7dd888 38%, ' +
        '#3b7dd844 62%, #3b7dd818 85%, transparent 100%)',
    )
  })
})

describe('Cone_Invariants: pulse and glyph (useMapMarkers.ts, carouselConstants.ts)', () => {
  it('pins PULSE_TEMPO', () => {
    expect(PULSE_TEMPO).toEqual({
      dormant: { animation: 'heartbeat', speed: '5s' },
      quiet: { animation: 'heartbeat', speed: '4s' },
      active: { animation: 'heartbeat', speed: '3s' },
      buzzing: { animation: 'heartbeat', speed: '2.2s' },
      popping: { animation: 'heartbeat', speed: '1.6s' },
    })
  })

  it('pins STATE_CONFIG', () => {
    expect(STATE_CONFIG).toEqual({
      dormant: { animation: 'heartbeat', speed: '5s', haloOpacity: 0.12, ripple: false },
      quiet: { animation: 'heartbeat', speed: '4s', haloOpacity: 0.2, ripple: false },
      active: { animation: 'heartbeat', speed: '3s', haloOpacity: 0.3, ripple: false },
      buzzing: { animation: 'heartbeat', speed: '2.2s', haloOpacity: 0.4, ripple: false },
      popping: { animation: 'heartbeat', speed: '1.6s', haloOpacity: 0.5, ripple: true },
    })
  })

  it('pins GLYPH_SIZE', () => {
    expect(GLYPH_SIZE).toEqual({ dormant: 18, quiet: 22, active: 28, buzzing: 36, popping: 46 })
  })
})

describe('Cone_Invariants: glyph outline rule (ArchetypeGlyph.tsx)', () => {
  // [requested size, expected outline stroke width = max(1, round(max(8, size) * 0.12))]
  const CASES: Array<[number, string]> = [
    [4, '1'],
    [8, '1'],
    [18, '2'],
    [28, '3'],
    [32, '4'],
    [46, '6'],
    [80, '10'],
  ]

  it.each(CASES)('size %d renders an outline stroke width of %s', (size, expected) => {
    const { container } = render(
      createElement(ArchetypeGlyph, {
        archetypeId: 'archetype-eclectic',
        pulseState: 'active',
        category: 'nightlife',
        size,
      }),
    )
    const outlineSvg = container.querySelector('svg')
    expect(outlineSvg).not.toBeNull()
    expect(outlineSvg!.style.strokeWidth).toBe(expected)
  })
})

describe('Cone_Invariants: category colours', () => {
  it('pins NODE_CATEGORY_HEX (shared contrast source)', () => {
    expect(NODE_CATEGORY_HEX).toEqual({
      food: '#ff6b6b',
      coffee: '#a0785a',
      nightlife: '#3b7dd8',
      retail: '#38bdf8',
      fitness: '#22d3a0',
      arts: '#ff9f43',
    })
  })

  it('pins the marker category colours (getCategoryColour)', () => {
    const resolved = Object.fromEntries(CATEGORIES.map((c) => [c, getCategoryColour(c)]))
    expect(resolved).toEqual({
      food: '#ff6b6b',
      coffee: '#a0785a',
      nightlife: '#3B7DD8',
      retail: '#38bdf8',
      fitness: '#22d3a0',
      arts: '#ff9f43',
    })
  })

  it('pins the --node-* tokens in both themes (tokens.css)', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../packages/shared/tokens.css'), 'utf8')
    const lightStart = css.indexOf(":root[data-theme='light']")
    expect(lightStart).toBeGreaterThan(0)
    const read = (block: string): Record<string, string> => {
      const out: Record<string, string> = {}
      for (const c of CATEGORIES) {
        const m = block.match(new RegExp(`--node-${c}:\\s*([^;]+);`))
        out[c] = m ? m[1]!.trim() : ''
      }
      return out
    }
    expect(read(css.slice(0, lightStart))).toEqual({
      food: '#ff6b6b',
      coffee: '#a0785a',
      nightlife: '#3b7dd8',
      retail: '#38bdf8',
      fitness: '#22d3a0',
      arts: '#ff9f43',
    })
    expect(read(css.slice(lightStart))).toEqual({
      food: '#e85555',
      coffee: '#8a6548',
      nightlife: '#2e6ab8',
      retail: '#2a96d0',
      fitness: '#18b888',
      arts: '#e08830',
    })
  })
})
