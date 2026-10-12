/**
 * Reports are a perk, not a pitch (north-star-alignment R7.2).
 *
 * The surfaces that sell GlyphCity to an owner lead with the Receipt, so none
 * of them may say "intelligence" or "insight": the business locale keys under
 * `biz.plans.`, `biz.onboarding.` and `biz.landing.`, and the trial and renewal
 * email builders in `ses.ts`. `biz.reports.*` and the report-ready email may
 * name the report and are deliberately not in this list.
 *
 * The locale file is read as data, not imported, so the backend gains no
 * dependency on an app (structure.md).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))
const PITCH = /intelligence|insight/i

const PITCH_KEY_PREFIXES = ['biz.plans.', 'biz.onboarding.', 'biz.landing.'] as const
const PITCH_EMAIL_BUILDERS = ['sendTrialExpiryEmail', 'sendRenewalReminderEmail', 'sendRenewalUpcomingEmail'] as const

/** The source of one exported function in `ses.ts`, up to the next top-level declaration. */
function builderSource(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  if (start === -1) return ''
  const rest = source.slice(start + 1)
  const next = rest.search(/\n(export |\/\*\*)/)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('no intelligence pitch on owner sales surfaces (R7.2)', () => {
  const copy = JSON.parse(readFileSync(`${REPO_ROOT}apps/business/src/i18n/locales/en.json`, 'utf8')) as Record<
    string,
    string
  >

  it.each(PITCH_KEY_PREFIXES)('no %s locale value says intelligence or insight', (prefix) => {
    const entries = Object.entries(copy).filter(([key]) => key.startsWith(prefix))
    const offenders = entries.filter(([, value]) => PITCH.test(value)).map(([key]) => key)

    expect(offenders).toEqual([])
  })

  it('reads a plans surface that exists, so the guard is not vacuous', () => {
    expect(Object.keys(copy).some((key) => key.startsWith('biz.plans.'))).toBe(true)
  })

  it.each(PITCH_EMAIL_BUILDERS)('%s says neither intelligence nor insight', (name) => {
    const source = readFileSync(`${REPO_ROOT}backend/src/shared/email/ses.ts`, 'utf8')
    const body = builderSource(source, name)

    expect(body).not.toBe('')
    expect(body).not.toMatch(PITCH)
  })
})
