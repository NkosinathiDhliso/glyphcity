import { FIRST_IN_KEY, PLAIN_SCALE_EN } from '@area-code/shared/constants/state-labels'
import type { PlacedStack } from '@area-code/shared/lib/pointMode/view'
import type { Node } from '@area-code/shared/types'
import { useTranslation } from 'react-i18next'

import { DEFAULT_ARCHETYPE_ID } from '../lib/carouselConstants'
import { getNodeState } from '../lib/mapHelpers'

import { PointModePin } from './PointModePin'

export interface PointModeStackProps {
  stack: PlacedStack<Node>
  pulseScores: Record<string, number>
  checkInCounts: Record<string, number>
  archetypeIds: Record<string, string>
  activeVenueId: string | null
  onSelect: (nodeId: string) => void
}

/**
 * One label over one or more cones, anchored at the nearest door. Venues the
 * compass cannot tell apart share the label, listed in vibeRank order, so the
 * view never guesses which door is which (R8.5).
 */
export function PointModeStack({
  stack,
  pulseScores,
  checkInCounts,
  archetypeIds,
  activeVenueId,
  onSelect,
}: PointModeStackProps) {
  const { t } = useTranslation()
  const hereNow = t('venueCard.hereNow', 'here now')
  const firstIn = t(FIRST_IN_KEY, PLAIN_SCALE_EN[FIRST_IN_KEY])

  return (
    <div
      className="absolute flex flex-col items-center gap-2 pointer-events-none"
      style={{ left: stack.x, top: stack.y, transform: 'translate(-50%, -100%)' }}
    >
      <ul className="glass-raised rounded-2xl px-1 py-1 flex flex-col pointer-events-auto max-w-[220px]">
        {stack.venues.map(({ venue }) => {
          const count = checkInCounts[venue.id] ?? 0
          return (
            <li key={venue.id}>
              <button
                type="button"
                onClick={() => onSelect(venue.id)}
                aria-pressed={venue.id === activeVenueId}
                className="min-h-11 w-full px-3 flex flex-row items-center justify-between gap-3 rounded-xl text-left active:scale-95"
              >
                <span className="text-[var(--text-primary)] text-sm font-semibold truncate">{venue.name}</span>
                <span className="text-[var(--text-secondary)] text-xs whitespace-nowrap">
                  {count > 0 ? `${count} ${hereNow}` : firstIn}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-row items-end gap-1 pointer-events-auto">
        {stack.venues.map(({ venue, scale }) => {
          const score = pulseScores[venue.id] ?? 0
          return (
            <PointModePin
              key={venue.id}
              node={venue}
              archetypeId={archetypeIds[venue.id] ?? venue.defaultArchetypeId ?? DEFAULT_ARCHETYPE_ID}
              state={getNodeState(score)}
              score={score}
              liveCount={checkInCounts[venue.id] ?? 0}
              scale={scale}
              isActive={venue.id === activeVenueId}
              dimmed={activeVenueId !== null && venue.id !== activeVenueId}
              onSelect={() => onSelect(venue.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
