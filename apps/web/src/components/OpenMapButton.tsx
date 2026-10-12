import { useTranslation } from 'react-i18next'

interface OpenMapButtonProps {
  onOpenMap: () => void
}

/**
 * The one next step on an empty board, an empty "you" row or an empty feed:
 * open the map (north-star-alignment R2.4, R4.3a). Empty states say less and
 * point to the room, never to a number.
 */
export function OpenMapButton({ onOpenMap }: OpenMapButtonProps) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpenMap}
      className="shrink-0 h-11 px-4 rounded-xl bg-[var(--accent-cta)] text-[var(--on-accent)] text-sm font-medium transition-all active:scale-95"
    >
      {t('common.openMap', 'Map')}
    </button>
  )
}
