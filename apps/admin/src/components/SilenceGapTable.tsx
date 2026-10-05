import { formatSastDayMonth } from '@area-code/shared/lib/sast'
import {
  SILENCE_MARGIN_POINTS,
  SILENCE_METRICS,
  formatGap,
  gapPoints,
  type FunnelWeek,
} from '@area-code/shared/lib/silenceRule'
import { useTranslation } from 'react-i18next'

/** Creator minus non-creator, per week, for the two measures the rule reads. */
export function SilenceGapTable({ weeks }: { weeks: FunnelWeek[] }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wide">
            <th className="py-2 pr-4">{t('admin.acquisition.col.week')}</th>
            {SILENCE_METRICS.map((m) => (
              <th key={m} className="py-2 pr-4 text-right whitespace-nowrap">
                {t(`admin.acquisition.metric.${m}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart} className="border-t border-[var(--border)]">
              <th scope="row" className="py-2 pr-4 text-left font-normal text-[var(--text-primary)] font-mono text-xs">
                {formatSastDayMonth(week.weekStart)}
                {!week.complete && (
                  <span className="text-[var(--text-muted)] ml-2">{t('admin.acquisition.openWeek')}</span>
                )}
              </th>
              {SILENCE_METRICS.map((m) => {
                const gap = gapPoints(week, m)
                const trailing = week.complete && gap !== null && gap > SILENCE_MARGIN_POINTS
                return (
                  <td
                    key={m}
                    className="py-2 pr-4 text-right font-mono text-xs"
                    style={{ color: trailing ? 'var(--warning)' : 'var(--text-secondary)' }}
                  >
                    {formatGap(gap)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
