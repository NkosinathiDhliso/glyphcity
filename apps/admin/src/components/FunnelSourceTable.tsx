import { ACQUISITION_LABELS, type AcquisitionLabel } from '@area-code/shared/constants/attribution'
import {
  formatRate,
  funnelRates,
  nonCreator,
  type FunnelWeek,
  type SourceWeek,
} from '@area-code/shared/lib/silenceRule'
import { useTranslation } from 'react-i18next'

interface Row {
  key: AcquisitionLabel | 'nonCreator'
  week: SourceWeek
}

function rowsFor(week: FunnelWeek): Row[] {
  const sources: Row[] = ACQUISITION_LABELS.filter((l) => l !== 'unknown').map((l) => ({
    key: l,
    week: week.sources[l],
  }))
  return [...sources, { key: 'nonCreator', week: nonCreator(week) }, { key: 'unknown', week: week.sources.unknown }]
}

const COLUMNS = ['taps', 'opens', 'opensPerTap', 'probes', 'checkInsPerOpen', 'signups', 'day1'] as const

/** One week's funnel, one row per Acquisition_Source plus the non-creator pool. */
export function FunnelSourceTable({ week }: { week: FunnelWeek }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wide">
            <th className="py-2 pr-4">{t('admin.acquisition.col.source')}</th>
            {COLUMNS.map((c) => (
              <th key={c} className="py-2 pr-4 text-right whitespace-nowrap">
                {t(`admin.acquisition.col.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsFor(week).map(({ key, week: w }) => {
            const rates = funnelRates(w)
            const cells = [
              w.events.venue_selected,
              w.events.venue_open,
              formatRate(rates.mapToDetail),
              formatRate(rates.probe),
              formatRate(rates.detailToCheckIn),
              w.signups,
              formatRate(rates.day1),
            ]
            return (
              <tr key={key} className="border-t border-[var(--border)]">
                <th
                  scope="row"
                  className={`py-2 pr-4 text-left text-[var(--text-primary)] whitespace-nowrap ${
                    key === 'nonCreator' ? 'font-semibold' : 'font-normal'
                  }`}
                >
                  {t(`admin.acquisition.source.${key}`)}
                </th>
                {cells.map((cell, i) => (
                  <td key={COLUMNS[i]} className="py-2 pr-4 text-right text-[var(--text-secondary)] font-mono text-xs">
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
