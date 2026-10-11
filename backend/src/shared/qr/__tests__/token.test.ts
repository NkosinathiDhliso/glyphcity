import { createHmac } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it } from 'vitest'

import { generateQrToken, QR_TOKEN_ROTATION_MS, validateQrToken } from '../token.js'

/**
 * The venue QR token has one home. These tests pin the wire format (a printed
 * or displayed code must keep scanning across a deploy) and the acceptance
 * window: the current 15-minute slot and the one before it, nothing else.
 */

const SECRET = 'test-qr-secret'
const NODE_ID = 'node-ramonas'
/** Mid-slot, so a step of one slot either way stays well inside a slot. */
const NOW = 1_000 * QR_TOKEN_ROTATION_MS + QR_TOKEN_ROTATION_MS / 2

beforeAll(() => {
  process.env['AREA_CODE_QR_HMAC_SECRET'] = SECRET
})

describe('generateQrToken', () => {
  it('is the first 32 hex characters of HMAC-SHA256(secret, nodeId + slot)', () => {
    const expected = createHmac('sha256', SECRET).update(`${NODE_ID}1000`).digest('hex').slice(0, 32)

    expect(generateQrToken(NODE_ID, NOW)).toBe(expected)
  })

  it('rotates at the slot boundary and not before', () => {
    const slotStart = 1_000 * QR_TOKEN_ROTATION_MS

    expect(generateQrToken(NODE_ID, slotStart + QR_TOKEN_ROTATION_MS - 1)).toBe(generateQrToken(NODE_ID, slotStart))
    expect(generateQrToken(NODE_ID, slotStart + QR_TOKEN_ROTATION_MS)).not.toBe(generateQrToken(NODE_ID, slotStart))
  })
})

describe('validateQrToken', () => {
  it('accepts the current slot', () => {
    expect(validateQrToken(NODE_ID, generateQrToken(NODE_ID, NOW), NOW)).toBe(true)
  })

  it('accepts the previous slot, so a code read just before a rotation still scans', () => {
    expect(validateQrToken(NODE_ID, generateQrToken(NODE_ID, NOW - QR_TOKEN_ROTATION_MS), NOW)).toBe(true)
  })

  it('rejects a code two slots old', () => {
    expect(validateQrToken(NODE_ID, generateQrToken(NODE_ID, NOW - 2 * QR_TOKEN_ROTATION_MS), NOW)).toBe(false)
  })

  it('rejects a code from the next slot', () => {
    expect(validateQrToken(NODE_ID, generateQrToken(NODE_ID, NOW + QR_TOKEN_ROTATION_MS), NOW)).toBe(false)
  })

  it("rejects another venue's code", () => {
    expect(validateQrToken(NODE_ID, generateQrToken('node-other', NOW), NOW)).toBe(false)
  })

  it('rejects a malformed token without throwing', () => {
    expect(validateQrToken(NODE_ID, 'short', NOW)).toBe(false)
    expect(validateQrToken(NODE_ID, '', NOW)).toBe(false)
  })
})

describe('one home (promoter-arrivals R5.4)', () => {
  const BACKEND_SRC = fileURLToPath(new URL('../../../', import.meta.url))
  const HOME = 'shared/qr/token.ts'

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
    })
  }

  it('defines generateQrToken and validateQrToken only in shared/qr/token.ts', () => {
    const definers = sourceFiles(BACKEND_SRC)
      .filter((file) => /function\s+(generateQrToken|validateQrToken)\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(BACKEND_SRC, file).split('\\').join('/'))

    expect(definers).toEqual([HOME])
  })
})
