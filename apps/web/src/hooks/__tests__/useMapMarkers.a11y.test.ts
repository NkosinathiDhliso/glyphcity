// @vitest-environment jsdom
/**
 * Marker accessible name wiring (glyphcity-rebrand R3.6): the glyph hit pad is
 * a keyboard button carrying the `accessibleNodeName` label, and the beam
 * column carries the same label.
 */
import { accessibleNodeName } from '@area-code/shared/lib/accessibleNodeName'
import type { Node } from '@area-code/shared/types'
import { describe, expect, it, vi } from 'vitest'

import { applyMarkerAccessibleName } from '../../lib/markerA11y'
import { buildMarkerElement } from '../useMapMarkers'

const t = (_key: string, defaultValue: string) => defaultValue
const node = { id: 'n1', name: 'Fox Street Yard', category: 'nightlife' } as Node

function build(onTap = vi.fn()) {
  const label = accessibleNodeName(node, 'archetype-township-royal', 'popping', 41, t)
  const el = buildMarkerElement(node, 46, '#f00', 'popping', 41, false, onTap, {}, undefined, undefined, label)
  return { el, label, onTap }
}

const layer = (el: HTMLElement, name: string) => el.querySelector(`[data-layer="${name}"]`) as HTMLElement

describe('marker accessible name', () => {
  it('glyph hit pad is a focusable button with the label', () => {
    const { el, label } = build()
    const hit = layer(el, 'glyph-hit')
    expect(hit.getAttribute('role')).toBe('button')
    expect(hit.tabIndex).toBe(0)
    expect(hit.getAttribute('aria-label')).toBe(label)
    expect(label).toBe('Fox Street Yard, Nightlife, The Township Royal, Very busy, 41 here now')
  })

  it('beam column carries the same label without a second tab stop', () => {
    const { el, label } = build()
    const beam = layer(el, 'beam-hit')
    expect(beam.getAttribute('role')).toBe('button')
    expect(beam.tabIndex).toBe(-1)
    expect(beam.getAttribute('aria-label')).toBe(label)
  })

  it('Enter and Space on the glyph pad fire the tap handler', () => {
    const { el, onTap } = build()
    const hit = layer(el, 'glyph-hit')
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    hit.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('relabels in place when presence changes', () => {
    const { el } = build()
    const next = accessibleNodeName(node, 'archetype-township-royal', 'popping', 0, t)
    applyMarkerAccessibleName(el, next)
    expect(layer(el, 'glyph-hit').getAttribute('aria-label')).toBe(
      'Fox Street Yard, Nightlife, The Township Royal, Quiet',
    )
    expect(el.querySelectorAll('[aria-label]')).toHaveLength(2)
  })
})
