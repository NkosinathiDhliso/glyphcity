import {
  SILENCE_CONSECUTIVE_WEEKS,
  SILENCE_MARGIN_POINTS,
  type SilenceMetric,
  type SilenceVerdict,
} from '@area-code/shared/lib/silenceRule'
import { useTranslation } from 'react-i18next'

const METRIC_KEYS: Record<SilenceMetric, string> = {
  mapToDetail: 'admin.acquisition.metric.mapToDetail',
  day1: 'admin.acquisition.metric.day1',
}

const TONE: Record<SilenceVerdict['status'], string> = {
  propose_next_cue: 'var(--warning)',
  hold: 'var(--success)',
  not_enough_data: 'var(--text-muted)',
}

/** The decision-10 verdict in one line, with the rule it applied. */
export function SilenceVerdictBanner({ verdict }: { verdict: SilenceVerdict }) {
  const { t } = useTranslation()
  const vars = {
    margin: SILENCE_MARGIN_POINTS,
    weeks: SILENCE_CONSECUTIVE_WEEKS,
    metric: verdict.metric ? t(METRIC_KEYS[verdict.metric]) : '',
  }
  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 flex flex-col gap-1"
      style={{ borderLeft: `4px solid ${TONE[verdict.status]}` }}
      aria-live="polite"
    >
      <h3 className="text-[var(--text-primary)] font-semibold text-sm">
        {t(`admin.acquisition.verdict.${verdict.status}.title`)}
      </h3>
      <p className="text-[var(--text-secondary)] text-xs">
        {t(`admin.acquisition.verdict.${verdict.status}.body`, vars)}
      </p>
    </section>
  )
}
