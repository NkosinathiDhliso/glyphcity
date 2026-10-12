import { APP_NAME } from '@area-code/shared/constants/brand'
import type { User } from '@area-code/shared/types'
import { Share2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildShareCardData, generateShareCard, shareOrCopy } from '../../lib/shareCard'
import { OpenMapButton } from '../OpenMapButton'

interface YourRankCardProps {
  user: User
  /** The viewer's place this week, or null when they have no check-in this week. */
  standing: { rank: number; venueCount: number; checkInCount: number } | null
  topVenueName: string | null
  onOpenMap: () => void
}

/**
 * The viewer's own row. With a check-in this week it shows rank, rooms and a
 * Share button (the share card holds only the viewer's own data). With none it
 * points to the map and nothing else: no share, no count to the next tier
 * (north-star-alignment R2.4).
 */
export function YourRankCard({ user, standing, topVenueName, onOpenMap }: YourRankCardProps) {
  const { t } = useTranslation()
  const [sharing, setSharing] = useState(false)

  const handleShare = useCallback(async () => {
    if (!standing) return
    setSharing(true)
    try {
      const cardData = buildShareCardData({
        rank: standing.rank,
        archetypeId: user.archetypeId ?? null,
        tier: user.tier,
        weeklyCheckInCount: standing.checkInCount,
        topVenueName,
        displayName: user.displayName,
      })
      const blob = await generateShareCard(cardData)
      const text = t('leaderboard.shareText', {
        rank: standing.rank,
        defaultValue: `I'm #{{rank}} this week on {{appName}}`,
      })
      await shareOrCopy(blob, typeof text === 'string' ? text : `I'm #${standing.rank} this week on ${APP_NAME}`)
    } catch {
      // Best-effort: a failed render or dismissed share sheet is a no-op.
    } finally {
      setSharing(false)
    }
  }, [user, standing, topVenueName, t])

  return (
    <>
      <div className="border-t border-[var(--border)] my-2" />
      <div
        data-testid="leaderboard-you"
        className="flex flex-row items-center gap-3 bg-[var(--bg-raised)] border border-[var(--accent)] rounded-2xl px-4 py-3"
      >
        {standing ? (
          <>
            <span className="text-[var(--accent)] text-sm font-medium w-6 text-right shrink-0">{standing.rank}</span>
            <p className="flex-1 min-w-0 text-[var(--text-primary)] text-sm font-medium">{t('leaderboard.you')}</p>
            <span className="text-[var(--text-secondary)] text-sm font-medium shrink-0">
              {t('leaderboard.rooms', { count: standing.venueCount, defaultValue: `${standing.venueCount} rooms` })}
            </span>
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={sharing}
              aria-label={t('leaderboard.shareRank', 'Share my rank')}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-[var(--accent)] transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50"
            >
              <Share2 size={18} strokeWidth={1.75} />
            </button>
          </>
        ) : (
          <>
            <p className="flex-1 min-w-0 text-[var(--text-secondary)] text-sm">
              {t('leaderboard.youEmpty', 'Not on the board yet. Open the map.')}
            </p>
            <OpenMapButton onOpenMap={onOpenMap} />
          </>
        )}
      </div>
    </>
  )
}
