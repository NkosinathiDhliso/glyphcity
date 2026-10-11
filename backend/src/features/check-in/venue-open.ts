/**
 * Venue_Open: the `open:{userId}:{nodeId}` row that makes "found you" a
 * measurement (proof-of-demand R2.1, R2.3, R2.4, R2.5, R11.1).
 *
 * One home for the row, shared by both sides of the receipt: the writer is
 * `POST /v1/nodes/:nodeId/open` (a consumer opened the venue's detail, or
 * arrived on it from a share or push link), the reader is the check-in service,
 * which resolves it through `resolveFoundVia` and consumes it. The row shape
 * itself is declared once, in `./found-via.ts`, so the gate and the storage can
 * never disagree about what is stored.
 *
 * What is stored, and nothing else: runs of `{ source, openedAt, lastOpenedAt,
 * away }`. No coordinates, no device data, no display name (R2.4, R11.1).
 * `away` is a boolean the client computes from a fresh position it never sends,
 * so the only spatial fact that leaves the device is "was I further than the
 * maximum check-in radius".
 *
 * Why it needs no sweeper: the TTL is the Attribution_Window from the latest
 * open, so an uncredited row expires on its own and the KV holds at most one
 * row per consumer per venue (R12.1, no new infrastructure).
 *
 * First inside the window wins (R2.3): the check-in is credited to the earliest
 * open that is still inside the Attribution_Window, so a repeat look never moves
 * the credit later and a consumer cannot refresh their way out of a Walk_In.
 * Keeping only the single earliest open was not enough: a look at noon held the
 * row while a 17:00 look reset its TTL, then aged out by a 21:00 check-in and
 * took the 17:00 look down with it. The row keeps every open that can still be
 * credited, folded into runs so it stays small (`mergeVenueOpen`).
 */

import { ATTRIBUTION_WINDOW_HOURS, OPEN_SOURCES, type OpenSource } from '@area-code/shared/constants/attribution'
import { z } from 'zod'

import { kvDel, kvGet, kvSet } from '../../shared/kv/dynamodb-kv.js'

import { ATTRIBUTION_WINDOW_MS, AWAY_GATE_MIN_MS, type VenueOpenRow, type VenueOpenRun } from './found-via.js'

/**
 * TTL of the row, in seconds. The same Attribution_Window the Away_Gate uses, so
 * a row that is too old to credit is normally gone rather than merely ignored.
 */
export const ATTRIBUTION_WINDOW_SECONDS = ATTRIBUTION_WINDOW_HOURS * 60 * 60

/** The one KV key for a consumer's open at a venue. */
export function venueOpenKey(userId: string, nodeId: string): string {
  return `open:${userId}:${nodeId}`
}

/**
 * Most runs one row holds. Opens from the same source fold into one run, and
 * runs older than the window are dropped on every write, so a real night out
 * stays far below this. Past it the newest open is dropped, never an older one:
 * dropping an older open could hand the credit to a later source, dropping the
 * newest can only under-claim.
 */
export const VENUE_OPEN_MAX_RUNS = 20

/**
 * The row as it comes back off the KV: untyped JSON until proven otherwise. A
 * row that does not match is treated as no row at all, which resolves to
 * `walk_in` — the honest direction.
 */
const venueOpenRowSchema = z.object({
  opens: z
    .array(
      z.object({
        source: z.enum(OPEN_SOURCES),
        openedAt: z.string().datetime(),
        lastOpenedAt: z.string().datetime(),
        away: z.boolean().nullable(),
      }),
    )
    .max(VENUE_OPEN_MAX_RUNS),
})

/** What the endpoint accepts and the service turns into a row. */
export interface VenueOpenInput {
  source: OpenSource
  away: boolean | null
}

/** One open as the merge sees it: the endpoint input, stamped with its instant. */
export interface VenueOpenInputAt extends VenueOpenInput {
  openedAt: string
}

// ─── Merge (pure) ───────────────────────────────────────────────────────────

/**
 * Fold a new open into the row already held for this consumer and venue.
 *
 * 1. Drop every run whose latest open is older than the window measured back
 *    from this open. Any later check-in is later still, so those runs can never
 *    be credited again.
 * 2. A full row (`VENUE_OPEN_MAX_RUNS`) drops the incoming open.
 * 3. Extend the latest run when this open has the same source and comes less
 *    than the Away_Gate time arm after it. `away` is a three-valued OR, so an
 *    away open is never discarded: any `true` → `true`; else any `false` →
 *    `false`; else `null` (unknown).
 * 4. Otherwise start a new run.
 *
 * The incoming open is stamped by the server, so it is the newest. An instant
 * earlier than the latest run (clock skew between invocations) is moved up to
 * that run's end: later, never earlier, so skew can only under-claim.
 *
 * Pure: the caller supplies both rows and persists the result, so the whole
 * rule is testable without a database.
 */
export function mergeVenueOpen(existing: VenueOpenRow | null, incoming: VenueOpenInputAt): VenueOpenRow {
  const incomingMs = Date.parse(incoming.openedAt)
  const horizon = incomingMs - ATTRIBUTION_WINDOW_MS
  const runs = (existing?.opens ?? []).filter((run) => Date.parse(run.lastOpenedAt) >= horizon)

  // A full row takes nothing more, not even a run extension: once an open has
  // been dropped, extending the run before it would skip over that open.
  if (runs.length >= VENUE_OPEN_MAX_RUNS) return { opens: runs }

  const latest = runs[runs.length - 1]
  const atMs = latest ? Math.max(incomingMs, Date.parse(latest.lastOpenedAt)) : incomingMs
  const at = new Date(atMs).toISOString()

  if (latest && latest.source === incoming.source && atMs - Date.parse(latest.lastOpenedAt) < AWAY_GATE_MIN_MS) {
    const extended: VenueOpenRun = { ...latest, lastOpenedAt: at, away: orAway(latest.away, incoming.away) }
    return { opens: [...runs.slice(0, -1), extended] }
  }
  return { opens: [...runs, { source: incoming.source, openedAt: at, lastOpenedAt: at, away: incoming.away }] }
}

function orAway(a: boolean | null, b: boolean | null): boolean | null {
  if (a === true || b === true) return true
  if (a === false || b === false) return false
  return null
}

// ─── Storage ────────────────────────────────────────────────────────────────

/**
 * Read the row for this consumer and venue, or `null` when there is none.
 *
 * A row that is present but unreadable (corrupt JSON, a source outside
 * `OPEN_SOURCES`, a missing field) is logged at error level and reported as
 * absent: we cannot verify the gate, so we do not claim the credit. The log is
 * loud on purpose, and carries the venue only — never the consumer.
 */
export async function readVenueOpen(userId: string, nodeId: string): Promise<VenueOpenRow | null> {
  const raw = await kvGet(venueOpenKey(userId, nodeId))
  if (raw === null) return null

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    console.error(`[venue-open] unparseable row for node ${nodeId}; reading as no open`)
    return null
  }

  const parsed = venueOpenRowSchema.safeParse(json)
  if (!parsed.success) {
    console.error(`[venue-open] row for node ${nodeId} failed validation; reading as no open`)
    return null
  }
  return parsed.data
}

/** Persist the row with a fresh Attribution_Window TTL. */
export async function writeVenueOpen(userId: string, nodeId: string, row: VenueOpenRow): Promise<void> {
  await kvSet(venueOpenKey(userId, nodeId), JSON.stringify(row), ATTRIBUTION_WINDOW_SECONDS)
}

/** Consume the row. Called once the check-in that used it has been written (R3.3). */
export async function deleteVenueOpen(userId: string, nodeId: string): Promise<void> {
  await kvDel(venueOpenKey(userId, nodeId))
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Record one Venue_Open, merging into any unexpired row (R2.3).
 *
 * Read-then-write rather than a conditional update: the only writer for a given
 * key is one consumer's own app, so there is no contention worth a transaction.
 * A duplicate landing twice folds into the same run.
 */
export async function recordVenueOpen(userId: string, nodeId: string, input: VenueOpenInput): Promise<void> {
  const incoming: VenueOpenInputAt = { ...input, openedAt: new Date().toISOString() }
  const existing = await readVenueOpen(userId, nodeId)
  await writeVenueOpen(userId, nodeId, mergeVenueOpen(existing, incoming))
}
