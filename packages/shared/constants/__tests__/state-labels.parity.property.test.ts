/**
 * Feature: GlyphCity rebrand, Property 3: label parity
 *
 * One home for State_Label parity. `PLAIN_SCALE_EN` is the source of truth;
 * every consuming app's `en.json` must carry exactly the same `state.*` keys
 * and values, and must resolve them through a real i18next lookup configured
 * the way the app configures it. The backend reads the same object; the share
 * snapshot half lives in `backend/src/features/nodes/__tests__/` because
 * packages/shared never imports from backend.
 *
 * **Validates: Requirements 2.1**
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import fc from 'fast-check'
import i18next, { type i18n } from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import type { NodeState } from '../../types'
import { BRAND_I18N_VARIABLES } from '../brand'
import * as stateLabels from '../state-labels'
import { PLAIN_SCALE_EN, stateLabelKey } from '../state-labels'

const APPS = ['web', 'mobile', 'business'] as const
type App = (typeof APPS)[number]

const ALL_STATES: NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']

const NUM_RUNS = 100

function readLocale(app: App): Record<string, unknown> {
  const path = resolve(__dirname, `../../../../apps/${app}/src/i18n/locales/en.json`)
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

/** Same options as `apps/{web,mobile,business}/src/i18n/index.ts` (default keySeparator). */
async function initLikeApp(app: App): Promise<i18n> {
  const instance = i18next.createInstance()
  await instance.init({
    resources: { en: { translation: readLocale(app) } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false, defaultVariables: BRAND_I18N_VARIABLES },
  })
  return instance
}

const instances = {} as Record<App, i18n>

beforeAll(async () => {
  for (const app of APPS) instances[app] = await initLikeApp(app)
})

describe('Feature: GlyphCity rebrand, Property 3: label parity', () => {
  it.each(APPS)('%s en.json holds exactly the PLAIN_SCALE_EN state keys and values', (app) => {
    const locale = readLocale(app)
    const stateKeys = Object.keys(locale).filter((k) => k === 'state' || k.startsWith('state.'))
    expect(stateKeys.sort()).toEqual(Object.keys(PLAIN_SCALE_EN).sort())
    for (const [key, value] of Object.entries(PLAIN_SCALE_EN)) {
      expect(locale[key]).toBe(value)
    }
  })

  it('stateLabelKey resolves to the same string via PLAIN_SCALE_EN and each app i18next', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_STATES), fc.constantFrom(...APPS), (state, app) => {
        const key = stateLabelKey(state)
        const instance = instances[app]
        expect(instance.exists(key)).toBe(true)
        expect(instance.t(key)).toBe(PLAIN_SCALE_EN[key])
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('the backend specifier resolves to the same PLAIN_SCALE_EN object', async () => {
    const viaSpecifier = await import('@area-code/shared/constants/state-labels')
    expect(viaSpecifier.PLAIN_SCALE_EN).toBe(stateLabels.PLAIN_SCALE_EN)
  })
})
