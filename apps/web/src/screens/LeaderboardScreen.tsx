import { Skeleton } from '@area-code/shared/components/Skeleton'
import { api } from '@area-code/shared/lib/api'
import { useMapStore } from '@area-code/shared/stores/mapStore'
import { useUserStore } from '@area-code/shared/stores/userStore'
import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { LeaderboardRow, type CityRankEntry } from '../components/leaderboard/LeaderboardRow'
import { YourRankCard } from '../components/leaderboard/YourRankCard'
import { OpenMapButton } from '../components/OpenMapButton'
import { resolveArchetypeDisplayName } from '../lib/archetypeDisplay'
import type { AppRoute } from '../types'

interface LeaderboardResponse {
  entries: CityRankEntry[]
  userRank: { rank: number; venueCount: number; checkInCount: number } | null
  segment: 'archetype' | 'city-wide'
}

interface LeaderboardScreenProps {
  onNavigate: (route: AppRoute) => void
}

export function LeaderboardScreen({ onNavigate }: LeaderboardScreenProps) {
  const { t } = useTranslation()
  const user = useUserStore((s) => s.user)
  const userCitySlug = user?.citySlug
  const userArchetypeId = user?.archetypeId
  const citySlug = userCitySlug ?? 'johannesburg'
  const setFocusNodeId = useMapStore((s) => s.setFocusNodeId)

  // Default to archetype view when user has an archetypeId, otherwise city-wide
  const [viewMode, setViewMode] = useState<'archetype' | 'city-wide'>(userArchetypeId ? 'archetype' : 'city-wide')

  // Sync view mode if user completes preferences and gains an archetypeId
  useEffect(() => {
    if (userArchetypeId && viewMode === 'city-wide') {
      setViewMode('archetype')
    }
  }, [userArchetypeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const archetypeParam = viewMode === 'archetype' && userArchetypeId ? userArchetypeId : undefined

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard', citySlug, archetypeParam],
    queryFn: () => {
      const url = archetypeParam
        ? `/v1/leaderboard/${citySlug}?archetypeId=${encodeURIComponent(archetypeParam)}`
        : `/v1/leaderboard/${citySlug}`
      return api.get<LeaderboardResponse>(url)
    },
    staleTime: 30_000,
  })

  const handleVenueStreakTap = useCallback(
    (nodeId: string) => {
      setFocusNodeId(nodeId)
      onNavigate('map')
    },
    [setFocusNodeId, onNavigate],
  )

  // Derive the title based on segment
  const title =
    viewMode === 'archetype' && userArchetypeId
      ? t('leaderboard.archetypeTitle', {
          archetype: resolveArchetypeDisplayName(userArchetypeId).replace(/^The /, ''),
          defaultValue: `Top {{archetype}}s this week`,
        })
      : t('leaderboard.title')

  return (
    <div
      className="flex flex-col h-full overflow-y-auto px-5 pb-4"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      data-scroll-container
    >
      <h1 className="text-[var(--text-primary)] font-bold text-xl font-display mb-1">{title}</h1>
      <p className="text-[var(--text-secondary)] text-xs mb-3">{t('leaderboard.thisWeek')}</p>

      {/* Segment toggle */}
      <div className="flex flex-row gap-2 mb-4" role="tablist" aria-label={t('leaderboard.viewToggle', 'View toggle')}>
        <button
          role="tab"
          aria-selected={viewMode === 'archetype'}
          onClick={() => setViewMode('archetype')}
          disabled={!userArchetypeId}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
            viewMode === 'archetype'
              ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)]'
          } ${!userArchetypeId ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {userArchetypeId
            ? t('leaderboard.myArchetype', {
                archetype: resolveArchetypeDisplayName(userArchetypeId).replace(/^The /, ''),
                defaultValue: 'My {{archetype}}s',
              })
            : t('leaderboard.archetype', 'My Tribe')}
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'city-wide'}
          onClick={() => setViewMode('city-wide')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
            viewMode === 'city-wide'
              ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)]'
          }`}
        >
          {t('leaderboard.cityWide', 'City-wide')}
        </button>
      </div>

      {/* Prompt to complete preferences when no archetypeId */}
      {!userArchetypeId && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-4 py-3 mb-4">
          <p className="text-[var(--text-secondary)] text-xs">
            {t(
              'leaderboard.completePreferences',
              'Complete your music preferences to unlock archetype ranks and see how you stack up against your tribe.',
            )}
          </p>
          <button onClick={() => onNavigate('profile')} className="text-[var(--accent)] text-xs font-medium mt-2">
            {t('leaderboard.setPreferences', 'Set up preferences →')}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-[var(--text-secondary)] text-sm text-center">
            {t('leaderboard.loadError', "Couldn't load the leaderboard. Check your connection.")}
          </p>
          <button onClick={() => void refetch()} className="text-[var(--accent)] text-sm font-medium">
            {t('common.retry', 'Retry')}
          </button>
        </div>
      ) : data?.entries && data.entries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.entries.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} onVenueStreakTap={handleVenueStreakTap} />
          ))}

          {/* The viewer's own row: their standing when they have a check-in this
              week, otherwise one pointer to the map (R2.4). */}
          {user && (
            <YourRankCard
              user={user}
              standing={viewerStanding(data, user.id)}
              topVenueName={data.entries.find((e) => e.userId === user.id)?.topVenueName ?? null}
              onOpenMap={() => onNavigate('map')}
            />
          )}
        </div>
      ) : (
        <div data-testid="leaderboard-empty" className="flex flex-col items-center gap-3 py-8">
          <p className="text-[var(--text-secondary)] text-sm text-center">{t('leaderboard.noData')}</p>
          <OpenMapButton onOpenMap={() => onNavigate('map')} />
        </div>
      )}
    </div>
  )
}

/** The viewer's rank, rooms and check-ins: from their top-50 row, else from `userRank`. */
function viewerStanding(
  data: LeaderboardResponse,
  userId: string,
): { rank: number; venueCount: number; checkInCount: number } | null {
  const row = data.entries.find((e) => e.userId === userId)
  if (row) return { rank: row.rank, venueCount: row.venueCount, checkInCount: row.checkInCount }
  return data.userRank
}
