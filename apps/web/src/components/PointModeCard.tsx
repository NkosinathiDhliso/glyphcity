import { PLAIN_SCALE_EN, stateLabelKey } from '@area-code/shared/constants/state-labels'
import { useMapStore } from '@area-code/shared/stores'
import type { Node } from '@area-code/shared/types'
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toVenueCardVM } from '../lib/carouselConstants'
import { shareVenue } from '../lib/shareVenue'

import { VenueCard } from './VenueCard'

export interface PointModeCardProps {
  node: Node
  onCheckIn: () => void
  isCheckingIn: boolean
}

/**
 * The selected venue on the camera view (R8.4): the browse card (glyph, count,
 * category word, Glyph_Name, Tonight), its State_Label, and Check in and
 * Share. Check-in is the map's own proximity flow, unchanged.
 */
export function PointModeCard({ node, onCheckIn, isCheckingIn }: PointModeCardProps) {
  const { t } = useTranslation()
  const checkInCounts = useMapStore((s) => s.checkInCounts)
  const pulseScores = useMapStore((s) => s.pulseScores)
  const archetypeIds = useMapStore((s) => s.archetypeIds)
  const momentum = useMapStore((s) => s.momentum)
  const vm = toVenueCardVM(node, checkInCounts, pulseScores, archetypeIds, momentum)
  const labelKey = stateLabelKey(vm.pulseState)

  return (
    <section
      aria-label={t('pointMode.cardLabel', 'Selected venue')}
      className="absolute left-3 right-3 flex flex-col gap-2 rounded-2xl p-3 bg-[var(--bg-raised)] border border-[var(--border)]"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <VenueCard vm={vm} category={node.category} isActive />
      <p className="text-[var(--text-secondary)] text-xs px-1">{t(labelKey, PLAIN_SCALE_EN[labelKey])}</p>
      <div className="flex flex-row gap-2">
        <button
          type="button"
          onClick={onCheckIn}
          disabled={isCheckingIn}
          className="flex-1 min-h-11 rounded-xl bg-[var(--accent-cta)] text-[var(--on-accent)] text-sm font-semibold active:scale-95 disabled:opacity-60"
        >
          {isCheckingIn ? t('pointMode.checkingIn', 'Checking in…') : t('pointMode.checkIn', 'Check in')}
        </button>
        <button
          type="button"
          onClick={() => shareVenue(node, t)}
          aria-label={t('pointMode.share', 'Share')}
          className="w-11 h-11 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95"
        >
          <Share2 size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--text-muted)] text-[11px] text-center">
        {t('pointMode.cameraPrivacy', 'Camera stays on your phone')}
      </p>
    </section>
  )
}
