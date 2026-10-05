import { usePointMode } from '@area-code/shared/lib/featureGating'
import { Camera } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { usePointModeSensors } from '../hooks/usePointModeSensors'
import { PointModeScreen } from '../screens/PointModeScreen'

export interface PointModeEntryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckIn: () => void
  isCheckingIn: boolean
}

/**
 * The map's camera control and the Point_Mode it opens (R8.1, R8.10). Behind
 * `point_mode`, off by default. Permissions are asked from this tap, never on
 * map load (R8.8). Closing keeps the selection.
 */
export function PointModeEntry({ open, onOpenChange, onCheckIn, isCheckingIn }: PointModeEntryProps) {
  const { t } = useTranslation()
  const sensors = usePointModeSensors()
  if (!usePointMode()) return null

  function openPointMode() {
    sensors.start()
    onOpenChange(true)
  }

  function closePointMode() {
    sensors.stop()
    onOpenChange(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openPointMode}
        aria-label={t('pointMode.open', 'Point your camera at a street')}
        className="shrink-0 glass-raised rounded-full w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] active:scale-95"
      >
        <Camera size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {/* Portalled so it covers the bottom nav; the top bar is its own stacking context. */}
      {open &&
        createPortal(
          <PointModeScreen
            sensors={sensors}
            onClose={closePointMode}
            onCheckIn={onCheckIn}
            isCheckingIn={isCheckingIn}
          />,
          document.body,
        )}
    </>
  )
}
