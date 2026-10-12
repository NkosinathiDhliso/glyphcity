/**
 * Leaderboard order, one home (north-star-alignment R2.2).
 *
 * The board counts rooms, not repetition: distinct venues checked into this
 * week first, then total check-ins, then user id ascending so the order is
 * total. The Ranks read and the weekly reset worker both rank through here, so
 * the users a pre-reset toast warns are exactly the ones the reset archives.
 *
 * Pure: no clock, no I/O.
 */

export interface LeaderboardRow {
  userId: string
  /** Distinct venues this week: the size of the row's `venues` string set. */
  venueCount: number
  checkInCount: number
  archetypeId?: string
  topVenueId?: string
  topVenueName?: string
}

/** Read one raw `LEADERBOARD#{cityId}` item. A row from before `venues` existed counts zero rooms. */
export function toLeaderboardRow(item: Record<string, unknown>): LeaderboardRow {
  const venues = item['venues']
  return {
    userId: item['userId'] as string,
    venueCount: venues instanceof Set ? venues.size : 0,
    checkInCount: (item['checkInCount'] as number | undefined) ?? 0,
    archetypeId: (item['archetypeId'] as string | undefined) ?? undefined,
    topVenueId: (item['topVenueId'] as string | undefined) ?? undefined,
    topVenueName: (item['topVenueName'] as string | undefined) ?? undefined,
  }
}

/** Rooms desc, check-ins desc, user id asc; then 1-based ranks over the whole set. */
export function rankLeaderboard<T extends Pick<LeaderboardRow, 'userId' | 'venueCount' | 'checkInCount'>>(
  rows: readonly T[],
): Array<T & { rank: number }> {
  return [...rows]
    .sort(
      (a, b) =>
        b.venueCount - a.venueCount ||
        b.checkInCount - a.checkInCount ||
        (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }))
}
