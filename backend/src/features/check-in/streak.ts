// Streak date math: one home for the SAST day boundary `updateStreak`
// (repository.ts) uses, so a streak a check-in keeps alive agrees with the
// calendar the rest of the product reads.

/**
 * The SAST (UTC+2) calendar date (`yyyy-mm-dd`) for an ISO timestamp. South
 * Africa observes no DST, so a fixed +2h offset is exact year-round.
 */
export function toSASTDate(dateStr: string): string {
  const date = new Date(dateStr)
  const sast = new Date(date.getTime() + 2 * 60 * 60 * 1000)
  return sast.toISOString().slice(0, 10)
}
