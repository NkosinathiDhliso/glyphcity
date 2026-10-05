/**
 * Retired State_Label guard (GlyphCity rebrand R2.4). "Popping", "Buzzing",
 * "Active" and "Dormant" never come back as displayed state words: not in
 * `PLAIN_SCALE_EN` and not in any app's user-facing `en.json`.
 *
 * A value trips the guard when it is exactly a retired word (any case) or
 * starts with one capitalised, the way a state label reads. Lowercase use
 * inside other copy ("active gets") is not a state label and passes.
 *
 * **Validates: Requirements 2.4**
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PLAIN_SCALE_EN } from '../state-labels'

const APPS_DIR = resolve(__dirname, '../../../../apps')

const EXACT = /^(popping|buzzing|active|dormant)$/i
const LEADING = /^(Popping|Buzzing|Active|Dormant)\b/

/**
 * Keys whose value matches the pattern but is not a venue state. Each entry
 * needs a reason.
 */
const ALLOWLIST: Record<string, string> = {
  // Admin archetype status filter (an archetype being enabled), not a venue Pulse_State.
  'admin/admin.archetypes.active': 'archetype status',
}

function isRetired(value: string): boolean {
  const v = value.trim()
  return EXACT.test(v) || LEADING.test(v)
}

/** Flatten nested or dotted locale JSON into `key -> string`. */
function flatten(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.push([key, v])
    else if (v && typeof v === 'object') out.push(...flatten(v as Record<string, unknown>, key))
  }
  return out
}

const LOCALE_APPS = readdirSync(APPS_DIR).filter((app) =>
  existsSync(resolve(APPS_DIR, app, 'src/i18n/locales/en.json')),
)

describe('Retired State_Labels stay retired (R2.4)', () => {
  it('finds the app locales to scan', () => {
    expect(LOCALE_APPS).toEqual(expect.arrayContaining(['web', 'mobile', 'business']))
  })

  it('PLAIN_SCALE_EN carries no retired word', () => {
    for (const value of Object.values(PLAIN_SCALE_EN)) {
      expect(isRetired(value)).toBe(false)
    }
  })

  it.each(LOCALE_APPS)('%s en.json carries no retired state word', (app) => {
    const path = resolve(APPS_DIR, app, 'src/i18n/locales/en.json')
    const locale = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const hits = flatten(locale)
      .filter(([key, value]) => isRetired(value) && !(`${app}/${key}` in ALLOWLIST))
      .map(([key, value]) => `${key}: ${value}`)
    expect(hits).toEqual([])
  })

  it('every allowlist entry still exists, so stale exemptions get removed', () => {
    for (const entry of Object.keys(ALLOWLIST)) {
      const [app, key] = entry.split('/') as [string, string]
      const path = resolve(APPS_DIR, app, 'src/i18n/locales/en.json')
      const locale = Object.fromEntries(flatten(JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>))
      expect(locale[key], entry).toBeDefined()
      expect(isRetired(locale[key] ?? '')).toBe(true)
    }
  })
})
