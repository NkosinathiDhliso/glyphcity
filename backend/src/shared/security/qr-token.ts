import { createHmac } from 'node:crypto'

import { qrHmacSecret } from '../config/env.js'

import { digestsEqual } from './hmac.js'

/**
 * Venue check-in QR tokens: the one home for minting and checking them.
 *
 * A token is the first 32 hex characters of `HMAC-SHA256(secret, nodeId + slot)`,
 * where `slot` is the current 15-minute window since the epoch. The business
 * portal mints the token the venue displays; the check-in service accepts the
 * current window and the one before it, so a code read just before a rotation
 * still scans. A token therefore stays valid for 15 to 30 minutes.
 */

/** How often a venue's displayed code rotates. */
export const QR_TOKEN_ROTATION_MS = 15 * 60 * 1000

function tokenForSlot(nodeId: string, slot: number): string {
  return createHmac('sha256', qrHmacSecret()).update(`${nodeId}${slot}`).digest('hex').slice(0, 32)
}

function slotAt(nowMs: number): number {
  return Math.floor(nowMs / QR_TOKEN_ROTATION_MS)
}

/** The token a venue displays at `nowMs`. */
export function generateQrToken(nodeId: string, nowMs: number = Date.now()): string {
  return tokenForSlot(nodeId, slotAt(nowMs))
}

/** True when `token` belongs to this venue's current or previous window. */
export function validateQrToken(nodeId: string, token: string, nowMs: number = Date.now()): boolean {
  const slot = slotAt(nowMs)
  return digestsEqual(token, tokenForSlot(nodeId, slot)) || digestsEqual(token, tokenForSlot(nodeId, slot - 1))
}
