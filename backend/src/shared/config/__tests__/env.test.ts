/**
 * Fail-fast security config accessors (audit-gap-closure R1).
 *
 * Validates: Requirements 1.1, 1.2, 1.5
 *
 * `qrHmacSecret()` and `assertStartupConfig()` are evaluated against the
 * environment captured at module load: `IS_PROD` / `DEV_MODE` are module-level
 * consts, so each case sets the environment, calls `vi.resetModules()`, then
 * dynamically imports `../env.js` and asserts. DEV_MODE derives from
 * `AREA_CODE_ENV === 'dev'` with `AREA_CODE_FORCE_LIVE` unset, so a non-dev env
 * (here `prod`) turns the fail-fast branch on.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function resetEnv(): void {
  process.env = { ...ORIGINAL_ENV }
  delete process.env['AREA_CODE_FORCE_LIVE']
  delete process.env['AREA_CODE_QR_HMAC_SECRET']
  delete process.env['AREA_CODE_CONSENT_VERSION']
  delete process.env['YOCO_WEBHOOK_SECRET']
  delete process.env['AREA_CODE_WEB_URL']
  delete process.env['AREA_CODE_BUSINESS_URL']
  delete process.env['AREA_CODE_FROM_EMAIL']
}

/** Every key `assertStartupConfig()` requires in prod, with glyphcity.com values. */
const PROD_REQUIRED: Record<string, string> = {
  AREA_CODE_QR_HMAC_SECRET: 'prod-qr-secret',
  AREA_CODE_CONSENT_VERSION: 'v1.0',
  YOCO_WEBHOOK_SECRET: 'whsec_prod_secret',
  AREA_CODE_WEB_URL: 'https://glyphcity.com',
  AREA_CODE_BUSINESS_URL: 'https://business.glyphcity.com',
  AREA_CODE_FROM_EMAIL: 'noreply@glyphcity.com',
}

function setProdRequired(except?: string): void {
  process.env['AREA_CODE_ENV'] = 'prod'
  for (const [key, value] of Object.entries(PROD_REQUIRED)) {
    if (key !== except) process.env[key] = value
  }
}

beforeEach(() => {
  vi.resetModules()
  resetEnv()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('qrHmacSecret() (R1.1, R1.2)', () => {
  it('throws when AREA_CODE_QR_HMAC_SECRET is unset outside DEV_MODE', async () => {
    process.env['AREA_CODE_ENV'] = 'prod'
    const { qrHmacSecret } = await import('../env.js')
    expect(() => qrHmacSecret()).toThrow(/AREA_CODE_QR_HMAC_SECRET is not set/)
  })

  it('returns the configured secret in prod when set', async () => {
    process.env['AREA_CODE_ENV'] = 'prod'
    process.env['AREA_CODE_QR_HMAC_SECRET'] = 'prod-qr-secret'
    const { qrHmacSecret } = await import('../env.js')
    expect(qrHmacSecret()).toBe('prod-qr-secret')
  })

  it('returns the dev default in DEV_MODE when unset', async () => {
    process.env['AREA_CODE_ENV'] = 'dev'
    const { qrHmacSecret } = await import('../env.js')
    expect(qrHmacSecret()).toBe('dev-qr-hmac-secret')
  })
})

describe('assertStartupConfig() (R1.2, R1.5)', () => {
  it('throws in prod when AREA_CODE_QR_HMAC_SECRET is missing', async () => {
    process.env['AREA_CODE_ENV'] = 'prod'
    process.env['AREA_CODE_CONSENT_VERSION'] = 'v1.0'
    const { assertStartupConfig } = await import('../env.js')
    expect(() => assertStartupConfig()).toThrow(/AREA_CODE_QR_HMAC_SECRET is not set/)
  })

  it('throws in prod when AREA_CODE_CONSENT_VERSION is missing', async () => {
    process.env['AREA_CODE_ENV'] = 'prod'
    process.env['AREA_CODE_QR_HMAC_SECRET'] = 'prod-qr-secret'
    const { assertStartupConfig } = await import('../env.js')
    expect(() => assertStartupConfig()).toThrow(/AREA_CODE_CONSENT_VERSION is not set/)
  })

  it('throws in prod when YOCO_WEBHOOK_SECRET is missing (webhook path fails loud)', async () => {
    process.env['AREA_CODE_ENV'] = 'prod'
    process.env['AREA_CODE_QR_HMAC_SECRET'] = 'prod-qr-secret'
    process.env['AREA_CODE_CONSENT_VERSION'] = 'v1.0'
    const { assertStartupConfig } = await import('../env.js')
    expect(() => assertStartupConfig()).toThrow(/YOCO_WEBHOOK_SECRET is not set/)
  })

  it('passes in prod when all required keys are set', async () => {
    setProdRequired()
    const { assertStartupConfig } = await import('../env.js')
    expect(() => assertStartupConfig()).not.toThrow()
  })

  // glyphcity-rebrand R7.3: app URLs and the sender crash startup when missing.
  it.each(['AREA_CODE_WEB_URL', 'AREA_CODE_BUSINESS_URL', 'AREA_CODE_FROM_EMAIL'])(
    'throws in prod when %s is missing',
    async (key) => {
      setProdRequired(key)
      const { assertStartupConfig } = await import('../env.js')
      expect(() => assertStartupConfig()).toThrow(new RegExp(`${key} is not set`))
    },
  )

  it('is a no-op in dev even when all keys are missing', async () => {
    process.env['AREA_CODE_ENV'] = 'dev'
    const { assertStartupConfig } = await import('../env.js')
    expect(() => assertStartupConfig()).not.toThrow()
  })
})
