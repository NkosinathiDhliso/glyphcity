// @vitest-environment jsdom
/**
 * SkyHeader: dawn or dusk sky with the venue's own Cone_Node, built by the
 * map's marker builder (glyphcity-rebrand task 4.5).
 *
 * Validates: Requirements 5.5, 4.1
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SkyHeader } from '../SkyHeader'

afterEach(() => {
  cleanup()
})

function renderHeader(state: 'quiet' | 'popping' = 'popping') {
  return render(
    <SkyHeader nodeId="node-1" category="nightlife" state={state} archetypeId="archetype-eclectic" height={136} />,
  )
}

describe('SkyHeader', () => {
  it('renders a cone node with the beam cone layer for the given state', () => {
    renderHeader('popping')
    const cone = document.querySelector('[data-layer="beam-cone"]')
    expect(cone).not.toBeNull()
    // Built by buildMarkerElement: the marker carries its node id and the
    // popping ripple layer.
    expect(document.querySelector('.node-marker[data-node-id="node-1"]')).not.toBeNull()
    expect(document.querySelector('[data-layer="ripple"]')).not.toBeNull()
  })

  it('omits the popping ripple for a quiet state', () => {
    renderHeader('quiet')
    expect(document.querySelector('[data-layer="beam-cone"]')).not.toBeNull()
    expect(document.querySelector('[data-layer="ripple"]')).toBeNull()
  })

  it('is decorative: the node is aria-hidden and inert', () => {
    renderHeader()
    const mount = screen.getByTestId('cone-node-mount')
    expect(mount.getAttribute('aria-hidden')).toBe('true')
    expect(mount.hasAttribute('inert')).toBe(true)
    const cone = document.querySelector('[data-layer="beam-cone"]')!
    expect(cone.closest('[aria-hidden="true"]')).not.toBeNull()
    // No accessible name is written onto the decorative instance.
    expect(document.querySelector('[aria-label]')).toBeNull()
  })

  it('draws the sky, the ridge and the star field from tokens', () => {
    renderHeader()
    const header = screen.getByTestId('sky-header')
    expect(header.style.background).toContain('var(--sky-top)')
    expect(header.querySelector('path')?.getAttribute('fill')).toBe('var(--ridge)')
    const stars = header.querySelectorAll('[data-star]')
    expect(stars.length).toBeGreaterThan(0)
    stars.forEach((s) => {
      expect((s as HTMLElement).style.background).toBe('var(--star)')
      // Static by design: no twinkle animation.
      expect((s as HTMLElement).style.animation).toBe('')
    })
  })

  it('unmounts cleanly with no leftover marker nodes', () => {
    const { unmount } = renderHeader()
    expect(document.querySelector('.node-marker')).not.toBeNull()
    unmount()
    expect(document.querySelector('.node-marker')).toBeNull()
    expect(document.querySelector('[data-layer="beam-cone"]')).toBeNull()
    expect(document.body.innerHTML).toBe('<div></div>')
  })
})
