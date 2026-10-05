/**
 * Point_Mode stacking (R8.5): venues closer in bearing than the compass can
 * tell apart share one label, so the view never guesses which door is which.
 */
import { POINT_MODE_MIN_CLUSTER_GAP_DEG } from './constants'

export interface InViewVenue<T> {
  venue: T
  /** Relative angle from the camera heading, degrees. */
  rel: number
  /** Position in vibeRank order; lower ranks first. */
  rank: number
}

export interface VenueStack<T> {
  /** Mean relative angle of the stack's venues. */
  rel: number
  /** Venues in vibeRank order. */
  venues: T[]
}

/** Smallest angle two separate labels may sit apart at this heading accuracy. */
export function clusterGapDeg(headingAccuracyDeg: number): number {
  return Math.max(headingAccuracyDeg, POINT_MODE_MIN_CLUSTER_GAP_DEG)
}

/**
 * Group venues whose neighbouring bearings sit closer than the gap. Each
 * venue lands in exactly one stack; stacks come back left to right.
 */
export function clusterByAngle<T>(inView: InViewVenue<T>[], headingAccuracyDeg: number): VenueStack<T>[] {
  const gap = clusterGapDeg(headingAccuracyDeg)
  const sorted = [...inView].sort((a, b) => a.rel - b.rel)
  const groups: InViewVenue<T>[][] = []
  for (const v of sorted) {
    const current = groups[groups.length - 1]
    const last = current?.[current.length - 1]
    if (current && last && v.rel - last.rel < gap) current.push(v)
    else groups.push([v])
  }
  return groups.map((g) => ({
    rel: g.reduce((sum, v) => sum + v.rel, 0) / g.length,
    venues: [...g].sort((a, b) => a.rank - b.rank).map((v) => v.venue),
  }))
}
