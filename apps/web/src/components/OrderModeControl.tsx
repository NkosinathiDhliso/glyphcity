import { ORDER_MODES, type OrderMode } from '@area-code/shared/constants/ranking'
import { useUserStore } from '@area-code/shared/stores/userStore'
import { useTranslation } from 'react-i18next'

import { chooseOrderMode } from '../lib/orderModePreference'

interface OrderModeControlProps {
  /** Re-rank the strip after the store holds the new mode. No camera move. */
  onChanged: () => void
}

const LABELS: Record<OrderMode, { key: string; en: string }> = {
  busy: { key: 'map.order.busiest', en: 'Busiest' },
  crowd: { key: 'map.order.crowd', en: 'My crowd' },
}

/**
 * Two-option browse order on the Browse_Mode strip (vibe-order-toggle R2).
 * Names the modes and nothing more: no tooltip, no explainer.
 */
export function OrderModeControl({ onChanged }: OrderModeControlProps) {
  const { t } = useTranslation()
  const orderMode = useUserStore((s) => s.orderMode)

  function select(mode: OrderMode) {
    if (mode === orderMode) return
    // The store write inside is synchronous, so the re-rank below sees it.
    void chooseOrderMode(mode, t)
    onChanged()
  }

  return (
    <div
      role="group"
      aria-label={t('map.order.label', 'Order venues by')}
      data-order-mode-control
      className="flex flex-row gap-1 p-1 rounded-xl bg-[var(--bg-raised)]"
    >
      {ORDER_MODES.map((mode) => {
        const active = mode === orderMode
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            data-order-mode={mode}
            onClick={() => select(mode)}
            className={`min-h-11 px-3 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 ${
              active ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {t(LABELS[mode].key, LABELS[mode].en)}
          </button>
        )
      })}
    </div>
  )
}
