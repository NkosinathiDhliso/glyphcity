import { Spinner } from '@area-code/shared/components/Spinner'
import {
  NOTIFICATION_PREFERENCE_KEYS as PREF_KEYS,
  NOTIFICATION_PREFERENCE_DEFAULTS as DEFAULTS,
  type NotificationPreferenceKey,
} from '@area-code/shared/constants/notification-preferences'
import {
  readNotificationPreferences,
  updateNotificationPreferences,
} from '@area-code/shared/lib/notificationPreferences'
import { useErrorStore } from '@area-code/shared/stores/errorStore'
import type { NotificationPreferences } from '@area-code/shared/types'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type PrefKey = NotificationPreferenceKey
type Prefs = NotificationPreferences

export function NotificationSettings() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)

  const { isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await readNotificationPreferences()
      setPrefs({ ...DEFAULTS, ...res })
      return res
    },
    staleTime: 60_000,
  })

  async function toggle(key: PrefKey) {
    const previous = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    try {
      await updateNotificationPreferences({ [key]: next[key] })
    } catch {
      setPrefs(previous)
      useErrorStore.getState().showError(t('notif.settings.saveFailed'))
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto px-5 pb-4"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      data-scroll-container
    >
      <div className="flex flex-row items-center gap-3 mb-4">
        <button
          onClick={() => window.history.back()}
          aria-label={t('common.back', 'Back')}
          className="text-[var(--text-secondary)] transition-all active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[var(--text-primary)] font-bold text-xl font-display">{t('notif.settings.title')}</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center mt-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {PREF_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => void toggle(key)}
              className="flex flex-row items-center justify-between bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-4 py-3 text-left"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-[var(--text-primary)] text-sm font-medium">{t(`notif.settings.${key}`)}</p>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">{t(`notif.settings.${key}Desc`)}</p>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[key] ? 'bg-[var(--accent)]' : 'bg-[var(--bg-raised)] border border-[var(--border)]'
                }`}
                role="switch"
                aria-checked={prefs[key]}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    prefs[key] ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
