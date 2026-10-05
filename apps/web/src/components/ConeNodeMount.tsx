import type { NodeCategory, NodeState } from '@area-code/shared/types'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { buildMarkerElement, getGlyphSize, GLYPH_HOST_LAYER } from '../hooks/useMapMarkers'
import { getCategoryColour } from '../lib/mapHelpers'
import { applyPresentationTier } from '../lib/markerBeam'

import { ArchetypeGlyph } from './ArchetypeGlyph'

export interface ConeNodeMountProps {
  /** Tags the marker element; no other node field is read. */
  nodeId: string
  category: NodeCategory
  state: NodeState
  archetypeId: string
  /** Pulse score feeding `getGlyphSize`, as on the map. */
  score?: number
  /** Box height the node is fitted into. The scale is fixed per mount. */
  height: number
}

/**
 * A decorative Cone_Node built by the map's own `buildMarkerElement`, so beam
 * geometry, glyph, outline and heartbeat can never drift from the map node
 * (glyphcity-rebrand R4.1, R5.5). The wrapper is `aria-hidden` and `inert`, so
 * the builder's button role and tab stop are unreachable here; the
 * surrounding surface already names the venue. Reduced motion is honoured by
 * the global `prefers-reduced-motion` rule in `app.css`, the same as the map.
 */
export function ConeNodeMount({ nodeId, category, state, archetypeId, score = 0, height }: ConeNodeMountProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [glyphHost, setGlyphHost] = useState<HTMLElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0, scale: 1 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // React 18 typings lack `inert`; set it on the DOM directly.
    host.setAttribute('inert', '')
    const glyphSize = getGlyphSize(state, score)
    const el = buildMarkerElement({ id: nodeId }, glyphSize, getCategoryColour(category), state, 0, false, () => {}, {
      glyphSize,
    })
    // Beam and glyph both shown, as at glyph zoom with the beam fully blended in.
    applyPresentationTier(el, 'glyph', true, false, 1, state)
    const naturalW = parseFloat(el.style.width)
    const naturalH = parseFloat(el.style.height)
    const scale = naturalH > 0 ? Math.min(1, height / naturalH) : 1
    Object.assign(el.style, {
      left: '0',
      top: '0',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    })
    host.replaceChildren(el)
    setBox({ width: naturalW * scale, height: naturalH * scale, scale })
    setGlyphHost(el.querySelector(`[data-layer="${GLYPH_HOST_LAYER}"]`) as HTMLElement | null)
    return () => {
      setGlyphHost(null)
      host.replaceChildren()
    }
  }, [nodeId, category, state, score, height])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-testid="cone-node-mount"
      className="relative shrink-0 pointer-events-none"
      style={{ width: box.width, height: box.height }}
    >
      {glyphHost &&
        createPortal(<ArchetypeGlyph archetypeId={archetypeId} pulseState={state} category={category} />, glyphHost)}
    </div>
  )
}
