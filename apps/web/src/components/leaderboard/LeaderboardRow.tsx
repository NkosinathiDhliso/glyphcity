import { Avatar } from '@area-code/shared/components/Avatar'
import { TierBadge } from '@area-code/shared/components/TierBadge'
import type { LeaderboardEntry, Tier } from '@area-code/shared/types'
import { useTranslation } from 'react-i18next'

export interface CityRankEntry extends LeaderboardEntry {
  topVenueId?: string
  topVenueName?: string
  archetypeId?: string
}

interface LeaderboardRowProps {
  entry: CityRankEntry
  onVenueStreakTap: (nodeId: string) => void
}

/**
 * One board row. Rooms lead and check-ins follow, small, so the board reads
 * as where a person has been, not how often they tapped (north-star-alignment R2).
 */
export function LeaderboardRow({ entry, onVenueStreakTap }: LeaderboardRowProps) {
  const { t } = useTranslation()
  const displayName = entry.isFriend
    ? entry.displayName || entry.username || t('leaderboard.anonymousExplorer')
    : t('leaderboard.anonymousExplorer')

  return (
    <div className="flex flex-row items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl px-4 py-3">
      <span className="text-[var(--text-secondary)] text-sm font-medium w-6 text-right shrink-0">{entry.rank}</span>

      {entry.isFriend ? (
        <Avatar
          url={entry.avatarUrl}
          displayName={typeof displayName === 'string' ? displayName : ''}
          size="sm"
          tier={entry.tier as Tier}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[var(--bg-raised)] flex items-center justify-center shrink-0">
          <TierBadge tier={entry.tier as Tier} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-primary)] text-sm font-medium truncate">{displayName}</p>
        {entry.topVenueName && entry.topVenueId && (
          <button
            onClick={() => onVenueStreakTap(entry.topVenueId!)}
            className="text-[var(--text-secondary)] text-xs truncate hover:text-[var(--accent)] transition-colors text-left"
            aria-label={t('leaderboard.venueStreakLabel', {
              venue: entry.topVenueName,
              defaultValue: 'Go to {{venue}}',
            })}
          >
            {entry.topVenueName}
          </button>
        )}
      </div>

      <TierBadge tier={entry.tier as Tier} />

      <div className="ml-1 shrink-0 text-right">
        <p data-testid="leaderboard-rooms" className="text-[var(--text-primary)] text-sm font-medium">
          {t('leaderboard.rooms', { count: entry.venueCount, defaultValue: `${entry.venueCount} rooms` })}
        </p>
        <p className="text-[var(--text-secondary)] text-[11px]">
          {t('leaderboard.checkIns', { count: entry.checkInCount, defaultValue: `${entry.checkInCount} check-ins` })}
        </p>
      </div>
    </div>
  )
}
