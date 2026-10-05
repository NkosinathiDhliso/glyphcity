import { TIER_SIZE_MULTIPLIER } from '@area-code/shared/constants'
import { accessibleNodeName } from '@area-code/shared/lib/accessibleNodeName'
import type { Node, NodeState } from '@area-code/shared/types'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { buildMarkerElement, getGlyphSize, GLYPH_HOST_LAYER } from '../hooks/useMapMarkers'
import { getCategoryColour } from '../lib/mapHelpers'
import { applyPresentationTier } from '../lib/markerBeam'

import { ArchetypeGlyph } from './ArchetypeGlyph'

export interface PointModePinProps {
  node: Node
  archetypeId: string
  state: NodeState
  score: number
  liveCount: number
  /** Depth scale from distance; the only thing distance changes. */
  scale: number
  isActive: boolean
  /** Another venue is selected: this one dims to 40%, as in Constellation. */
  dimmed: boolean
  onSelect: () => void
}

/**
 * One Cone_Node on the camera view, built by the map's own marker builder so
 * beam geometry, glyph, outline and heartbeat stay the frozen ones (R4, R8.2).
 */
export function PointModePin(props: PointModePinProps) {
  const { node, archetypeId, state, score, liveCount, scale, isActive, dimmed, onSelect } = props
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [glyphHost, setGlyphHost] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const tierScale = TIER_SIZE_MULTIPLIER[node.businessTier ?? 'starter']
    const glyphSize = getGlyphSize(state, score) * tierScale
    const el = buildMarkerElement(
      node,
      glyphSize,
      getCategoryColour(node.category),
      state,
      liveCount,
      isActive,
      () => onSelectRef.current(),
      { tierBaseScale: tierScale, glyphSize },
      undefined,
      undefined,
      accessibleNodeName(node, archetypeId, state, liveCount, t),
    )
    // Beam and glyph both shown, as at glyph zoom with the beam fully blended in.
    applyPresentationTier(el, 'glyph', true, false, 1, state)
    Object.assign(el.style, { left: '0', top: '0', transformOrigin: 'top left' })
    host.replaceChildren(el)
    markerRef.current = el
    setSize({ width: parseFloat(el.style.width), height: parseFloat(el.style.height) })
    setGlyphHost(el.querySelector(`[data-layer="${GLYPH_HOST_LAYER}"]`) as HTMLElement | null)
    return () => {
      markerRef.current = null
      setGlyphHost(null)
      host.replaceChildren()
    }
  }, [node, archetypeId, state, score, liveCount, isActive, t])

  // Distance scales the whole marker; nothing else about it changes.
  useEffect(() => {
    if (markerRef.current) markerRef.current.style.transform = `scale(${scale})`
  }, [scale, glyphHost])

  return (
    <div
      ref={hostRef}
      className="relative shrink-0 transition-opacity duration-200"
      style={{
        width: size.width * scale,
        height: size.height * scale,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {glyphHost &&
        createPortal(
          <ArchetypeGlyph archetypeId={archetypeId} pulseState={state} category={node.category} />,
          glyphHost,
        )}
    </div>
  )
}
