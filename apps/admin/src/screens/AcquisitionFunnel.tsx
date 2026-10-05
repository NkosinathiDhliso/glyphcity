import { api } from '@area-code/shared/lib/api'
import { formatSastDayMonth, formatSastTime } from '@area-code/shared/lib/sast'
import type { AcquisitionFunnelPayload } from '@area-code/shared/lib/silenceRule'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FunnelSourceTable } from '../components/FunnelSourceTable'
import { SilenceGapTable } from '../components/SilenceGapTable'
import { SilenceVerdictBanner } from '../components/SilenceVerdictBanner'

const WEEKS_OPTIONS = [4, 8, 12] as const

/**
 * Funnels split by Acquisition_Source (GlyphCity rebrand R11.2): do people a
 * creator did not bring still read the map? The verdict applies decision 10.
 */
export function AcquisitionFunnel() {
  const { t } = useTranslation()
  const [weeks, setWeeks] = useState<number>(8)
  const [data, setData] = useState<AcquisitionFunnelPayload | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  async function fetchFunnel(w: number) {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await api.get<AcquisitionFunnelPayload>(`/v1/admin/acquisition-funnel?weeks=${w}`)
      setData(res)
      setSelected(res.weeks.find((wk) => wk.complete)?.weekStart ?? res.weeks[0]?.weekStart ?? null)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchFunnel(weeks)
  }, [weeks])

  const week = data?.weeks.find((w) => w.weekStart === selected) ?? null

  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[var(--text-primary)] font-bold text-xl font-[Syne]">{t('admin.acquisition.title')}</h2>
          <p className="text-[var(--text-muted)] text-xs mt-1">{t('admin.acquisition.subtitle')}</p>
        </div>
        <div className="flex flex-row items-center gap-2">
          {WEEKS_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              disabled={loading}
              aria-pressed={w === weeks}
              className={`min-h-11 px-3 rounded-xl text-xs active:scale-95 transition-all duration-150 ${
                w === weeks
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]'
              }`}
            >
              {w}w
            </button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div className="text-[var(--text-muted)] text-sm text-center py-12">{t('admin.acquisition.loading')}</div>
      )}

      {loadError && !data && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-[var(--text-muted)] text-sm">{t('admin.acquisition.loadError')}</p>
          <button onClick={() => void fetchFunnel(weeks)} className="min-h-11 px-4 text-[var(--accent)] text-sm">
            {t('admin.acquisition.retry')}
          </button>
        </div>
      )}

      {data && (
        <>
          <SilenceVerdictBanner verdict={data.verdict} />

          <section className="flex flex-col gap-3">
            <h3 className="text-[var(--text-primary)] font-semibold text-sm">{t('admin.acquisition.weekHeading')}</h3>
            <div className="flex flex-row gap-2 overflow-x-auto no-scrollbar">
              {data.weeks.map((w) => (
                <button
                  key={w.weekStart}
                  onClick={() => setSelected(w.weekStart)}
                  aria-pressed={w.weekStart === selected}
                  className={`flex-shrink-0 min-h-11 px-3 rounded-xl text-xs whitespace-nowrap active:scale-95 ${
                    w.weekStart === selected
                      ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  {formatSastDayMonth(w.weekStart)}
                  {!w.complete && ` ${t('admin.acquisition.openWeek')}`}
                </button>
              ))}
            </div>
            {week && <FunnelSourceTable week={week} />}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[var(--text-primary)] font-semibold text-sm">{t('admin.acquisition.gapHeading')}</h3>
            <SilenceGapTable weeks={data.weeks} />
          </section>

          <p className="text-[var(--text-muted)] text-xs">{t('admin.acquisition.notes')}</p>
          <p className="text-[var(--text-muted)] text-xs text-center">
            {t('admin.acquisition.generated', {
              minutes: data.cacheMinutes,
              time: formatSastTime(data.generatedAt),
            })}
          </p>
        </>
      )}
    </div>
  )
}
