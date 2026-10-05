import { accessibleNodeName } from '@area-code/shared/lib/accessibleNodeName'
import { checkSignal } from '@area-code/shared/lib/pointMode/accuracy'
import { placeVenues } from '@area-code/shared/lib/pointMode/view'
import { useMapStore, useSelectionStore } from '@area-code/shared/stores'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PointModeCard } from '../components/PointModeCard'
import { PointModeFallback, type PointModeFallbackKind } from '../components/PointModeFallback'
import { PointModeStack } from '../components/PointModeStack'
import type { PointModeSensors } from '../hooks/usePointModeSensors'
import { DEFAULT_ARCHETYPE_ID, RECOMMENDED_LIMIT } from '../lib/carouselConstants'
import { getNodeState } from '../lib/mapHelpers'
import { rankVenuesFromStores } from '../lib/rankVenues'

/** How long to wait for a first fix and heading before saying the signal is not good enough. */
const LOCATE_TIMEOUT_MS = 6_000

export interface PointModeScreenProps {
  sensors: PointModeSensors
  onClose: () => void
  onCheckIn: () => void
  isCheckingIn: boolean
}

function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/**
 * Point_Mode (R8): the rear camera with Cone_Nodes on the doors in front of
 * you, placed by GPS and compass. Same venues and order as the map; nothing
 * from the camera or sensors leaves the phone.
 */
export function PointModeScreen({ sensors, onClose, onCheckIn, isCheckingIn }: PointModeScreenProps) {
  const { t } = useTranslation()
  const { status, stream, position, heading, start } = sensors
  const videoRef = useRef<HTMLVideoElement>(null)
  const { width, height } = useViewportSize()

  const nodes = useMapStore((s) => s.nodes)
  const pulseScores = useMapStore((s) => s.pulseScores)
  const checkInCounts = useMapStore((s) => s.checkInCounts)
  const archetypeIds = useMapStore((s) => s.archetypeIds)
  const activeVenueId = useSelectionStore((s) => s.activeVenueId)

  const [waitedLong, setWaitedLong] = useState(false)
  useEffect(() => {
    setWaitedLong(false)
    if (status !== 'live') return
    const id = window.setTimeout(() => setWaitedLong(true), LOCATE_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [status])

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  // Same membership (the city payload) and the same order (vibeRank) as the map.
  // The ranker reads the stores itself; these deps re-rank when a signal moves.
  const ranked = useMemo(
    () => rankVenuesFromStores(Object.values(nodes)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signals the ranker reads from the stores
    [nodes, pulseScores, checkInCounts, archetypeIds],
  )

  const signal = checkSignal({
    gpsAccuracyMetres: position?.accuracyMetres ?? null,
    headingAccuracyDeg: heading?.accuracyDeg ?? null,
  })
  const view =
    status === 'live' && position && heading && signal.ok
      ? placeVenues({
          ranked,
          position,
          headingDeg: heading.deg,
          headingAccuracyDeg: heading.accuracyDeg ?? 0,
          width,
          height,
          limit: RECOMMENDED_LIMIT,
        })
      : null

  let fallback: PointModeFallbackKind | null = null
  if (status === 'idle' || status === 'starting') fallback = 'starting'
  else if (status !== 'live') fallback = status
  else if (!position || !heading) fallback = waitedLong ? 'signal' : 'locating'
  else if (!signal.ok) fallback = 'signal'
  else if (view && view.inRadius === 0) fallback = 'nothing-near'

  const select = (nodeId: string) => useSelectionStore.getState().selectVenue(nodeId, 'marker')
  const activeNode = activeVenueId ? (nodes[activeVenueId] ?? null) : null
  const inView = view?.ranked ?? []

  return (
    <div className="fixed inset-0 z-[9000] overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {view &&
        view.stacks.map((stack) => (
          <PointModeStack
            key={stack.venues.map((v) => v.venue.id).join('|')}
            stack={stack}
            pulseScores={pulseScores}
            checkInCounts={checkInCounts}
            archetypeIds={archetypeIds}
            activeVenueId={activeVenueId}
            onSelect={select}
          />
        ))}

      {/* The venues in frame as text, for screen readers (R8.9). */}
      <ul className="sr-only" aria-label={t('pointMode.inViewList', 'Venues in view')}>
        {inView.map((node) => {
          const score = pulseScores[node.id] ?? 0
          const archetypeId = archetypeIds[node.id] ?? node.defaultArchetypeId ?? DEFAULT_ARCHETYPE_ID
          return (
            <li key={node.id}>
              <button type="button" onClick={() => select(node.id)}>
                {accessibleNodeName(node, archetypeId, getNodeState(score), checkInCounts[node.id] ?? 0, t)}
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('pointMode.backToMap', 'Back to map')}
        className="absolute left-3 w-11 h-11 rounded-full glass-raised flex items-center justify-center text-[var(--text-primary)] active:scale-95"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 0px))' }}
      >
        <X size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {fallback && <PointModeFallback kind={fallback} onBack={onClose} onRetry={start} />}

      {!fallback && activeNode && <PointModeCard node={activeNode} onCheckIn={onCheckIn} isCheckingIn={isCheckingIn} />}
    </div>
  )
}
