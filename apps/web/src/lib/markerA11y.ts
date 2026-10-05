import { BEAM_HIT_LAYER } from './markerBeam'

/** Marker sub-element that owns the glyph tap target (selection input). */
export const GLYPH_HIT_LAYER = 'glyph-hit'

/**
 * Make the glyph hit pad a keyboard button: one tab stop per venue, Enter or
 * Space fires the same handler as a click.
 */
export function wireKeyActivation(hit: HTMLElement, onActivate: () => void): void {
  hit.setAttribute('role', 'button')
  hit.tabIndex = 0
  hit.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    onActivate()
  })
}

/**
 * Write the accessible name (glyphcity-rebrand R3.6) onto the marker's hit
 * targets: the glyph pad and the Constellation beam column. This is the one
 * place a marker's `aria-label` is set. The beam column is a pointer target
 * only (`tabIndex = -1`), so keyboard focus has a single stop, the glyph pad.
 */
export function applyMarkerAccessibleName(markerEl: HTMLElement, label: string): void {
  const glyphHit = markerEl.querySelector(`[data-layer="${GLYPH_HIT_LAYER}"]`) as HTMLElement | null
  if (glyphHit) glyphHit.setAttribute('aria-label', label)
  const beamHit = markerEl.querySelector(`[data-layer="${BEAM_HIT_LAYER}"]`) as HTMLElement | null
  if (beamHit) {
    beamHit.setAttribute('role', 'button')
    beamHit.tabIndex = -1
    beamHit.setAttribute('aria-label', label)
  }
}
