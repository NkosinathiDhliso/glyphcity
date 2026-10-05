import { APP_NAME } from '@area-code/shared/constants/brand'
import { useTranslation } from 'react-i18next'

export type PointModeFallbackKind =
  | 'starting'
  | 'locating'
  | 'unsupported'
  | 'camera-denied'
  | 'location-denied'
  | 'motion-denied'
  | 'signal'
  | 'nothing-near'
  | 'paused'

const COPY: Record<PointModeFallbackKind, { key: string; fallback: string }> = {
  starting: { key: 'pointMode.starting', fallback: 'Opening the camera…' },
  locating: { key: 'pointMode.locating', fallback: 'Hold still while we find where you are pointing' },
  unsupported: { key: 'pointMode.unsupported', fallback: 'This browser cannot open the camera' },
  'camera-denied': { key: 'pointMode.cameraDenied', fallback: 'Camera is off for {{appName}}' },
  'location-denied': { key: 'pointMode.locationDenied', fallback: 'Location is off, so beams cannot be placed' },
  'motion-denied': {
    key: 'pointMode.motionDenied',
    fallback: 'Motion access is off, so we cannot tell where you are pointing',
  },
  signal: { key: 'pointMode.signal', fallback: 'Point mode needs a clearer signal' },
  'nothing-near': { key: 'pointMode.nothingNear', fallback: 'Nothing live on this street' },
  paused: { key: 'pointMode.paused', fallback: 'Point mode paused' },
}

/** States that offer another try besides going back. */
const RETRYABLE: ReadonlySet<PointModeFallbackKind> = new Set(['motion-denied', 'paused'])

/** Waiting states that show no buttons; the close control stays available. */
const WAITING: ReadonlySet<PointModeFallbackKind> = new Set(['starting', 'locating'])

export interface PointModeFallbackProps {
  kind: PointModeFallbackKind
  onBack: () => void
  onRetry: () => void
}

/** One designed state per reason Point_Mode places no beams, each with a way back (R8.6, R8.8). */
export function PointModeFallback({ kind, onBack, onRetry }: PointModeFallbackProps) {
  const { t } = useTranslation()
  const { key, fallback } = COPY[kind]
  return (
    <div
      role="status"
      className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 rounded-2xl p-5 bg-[var(--bg-raised)] border border-[var(--border)]"
    >
      <p className="text-[var(--text-primary)] text-sm font-medium text-center">
        {t(key, { defaultValue: fallback, appName: APP_NAME })}
      </p>
      {!WAITING.has(kind) && (
        <div className="flex flex-row gap-2">
          {RETRYABLE.has(kind) && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 px-4 rounded-xl bg-[var(--accent-cta)] text-[var(--on-accent)] text-sm font-semibold active:scale-95"
            >
              {kind === 'paused' ? t('pointMode.resume', 'Resume') : t('common.retry', 'Retry')}
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 px-4 rounded-xl border border-[var(--border)] text-[var(--text-primary)] text-sm active:scale-95"
          >
            {t('pointMode.backToMap', 'Back to map')}
          </button>
        </div>
      )}
    </div>
  )
}
