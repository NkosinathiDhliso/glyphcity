/**
 * Helpers for the glyphcity-rebrand specs (task 16.2, R12.4).
 *
 * The brand, Plain_Scale and glyph strings are read from their one home in the
 * repo (`packages/shared/constants/*`) rather than retyped: this package is not
 * in the pnpm workspace, so it parses the source files instead of importing.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Page } from '@playwright/test'

import { flag } from './env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

function readShared(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, 'packages', 'shared', relative), 'utf8')
}

function unquote(raw: string): string {
  return raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"')
}

const QUOTED = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`

/** Brand_Constants (`constants/brand.ts`). */
function readBrand(): { appName: string; companyName: string } {
  const src = readShared('constants/brand.ts')
  const pick = (name: string): string => {
    const m = new RegExp(String.raw`export const ${name}\s*=\s*${QUOTED}`).exec(src)
    if (!m?.[1]) throw new Error(`brand.ts: ${name} not found`)
    return unquote(m[1])
  }
  return { appName: pick('APP_NAME'), companyName: pick('COMPANY_NAME') }
}

export const BRAND = readBrand()

/** Glyph_Names and descriptions (`constants/archetype-catalog.ts`). */
function readCatalog(): Array<{ name: string; description: string }> {
  const src = readShared('constants/archetype-catalog.ts')
  const re = new RegExp(String.raw`name:\s*${QUOTED},[\s\S]*?description:\s*${QUOTED}`, 'g')
  const out: Array<{ name: string; description: string }> = []
  for (const m of src.matchAll(re)) out.push({ name: unquote(m[1]!), description: unquote(m[2]!) })
  if (out.length < 15) throw new Error(`archetype-catalog.ts: parsed ${out.length} glyphs, expected at least 15`)
  return out
}

export const GLYPHS = readCatalog()

/** Plain_Scale (`constants/state-labels.ts`), keyed by NodeState id. */
function readPlainScale(): Record<'dormant' | 'quiet' | 'active' | 'buzzing' | 'popping', string> {
  const src = readShared('constants/state-labels.ts')
  const word = (key: string): string => {
    const m = new RegExp(String.raw`'${key.replace('.', '\\.')}':\s*${QUOTED}`).exec(src)
    if (!m?.[1]) throw new Error(`state-labels.ts: ${key} not found`)
    return unquote(m[1])
  }
  const firstIn = new RegExp(String.raw`\[FIRST_IN_KEY\]:\s*${QUOTED}`).exec(src)
  if (!firstIn?.[1]) throw new Error('state-labels.ts: FIRST_IN_KEY word not found')
  return {
    dormant: unquote(firstIn[1]),
    quiet: word('state.quiet'),
    active: word('state.aLittleBusy'),
    buzzing: word('state.busy'),
    popping: word('state.veryBusy'),
  }
}

export const PLAIN_SCALE = readPlainScale()

/** Retired State_Label words (R2.4). Word-bounded so "Activewear" style names never trip it. */
export const RETIRED_STATE_WORDS = /\b(popping|buzzing|active|dormant)\b/i

/**
 * "Area Code" or its domain in user-facing text (R1.4). Contact mailboxes
 * (`support@areacode.co.za`) are allowed: glyphcity.com receives no mail yet
 * (`CONTACT_MAIL_DOMAIN` in brand.ts, decision 4 in
 * `docs/decisions/glyphcity-rebrand.md`).
 */
export const COMPANY_LITERAL = new RegExp(`${BRAND.companyName}|(?<!@)areacode\\.co\\.za`, 'i')

/**
 * What the local target was built with. The rebrand specs need the dev mock
 * (deterministic venues at every state, a signed-in consumer) and Point_Mode
 * needs `VITE_FLAG_POINT_MODE=true` at build time (`featureGating.ts` has no
 * runtime override). Declared by the runner, so a misbuilt target fails
 * instead of silently skipping.
 */
export const TARGET = {
  devMock: flag('E2E_DEV_MOCK'),
  pointMode: flag('E2E_POINT_MODE'),
  liveDomains: flag('E2E_LIVE_DOMAINS'),
}

/**
 * Dev-mock venues used by the Plain_Scale checks, one per NodeState. Mirrors
 * `packages/shared/mocks/data/nodes.ts` and `pulseScores.ts`. Picked so the
 * mock socket's upward drift (one node per 8-20 s tick, in list order) cannot
 * move any of them across a band within a test.
 */
export const MOCK_VENUES = {
  popping: { id: 'mock-node-3', slug: 'kitcheners-bar', name: "Kitchener's Bar", category: 'Nightlife' },
  buzzing: { id: 'mock-node-1', slug: 'nandos-rosebank', name: "Nando's Rosebank", category: 'Food' },
  active: { id: 'mock-node-11', slug: 'keyes-art-mile', name: 'Keyes Art Mile', category: 'Arts' },
  quiet: { id: 'mock-node-12', slug: 'planet-fitness-melrose', name: 'Planet Fitness Melrose', category: 'Fitness' },
  dormant: { id: 'mock-node-8', slug: 'doubleshot-braamfontein', name: 'Doubleshot Coffee', category: 'Coffee' },
} as const

export type Theme = 'light' | 'dark'

/** Persisted theme override read by `useTheme` before first paint. */
export async function presetTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem('area-code:theme-preference', value)
  }, theme)
}

type Portal = 'consumer' | 'business' | 'staff' | 'admin'

/**
 * A dev-mock session per portal: the token shapes `mockRouter.ts` issues from
 * its own login routes. They only mean anything to the in-browser mock layer;
 * a real API rejects them.
 */
const DEV_MOCK_SESSION: Record<Portal, Record<string, string>> = {
  consumer: {
    'consumer:accessToken': 'dev-access-mock-user-4',
    'consumer:refreshToken': 'dev-refresh-mock-user-4',
    'consumer:userId': 'mock-user-4',
  },
  business: {
    'business:accessToken': 'dev-access-mock-biz-2',
    'business:refreshToken': 'dev-refresh-mock-biz-2',
    'business:businessId': 'mock-biz-2',
    'business:role': 'owner',
  },
  // No staffName: StaffHome shows the wordmark only when no name is set.
  staff: {
    'staff:accessToken': 'dev-access-mock-staff-1',
    'staff:refreshToken': 'dev-refresh-mock-staff-1',
    'staff:staffId': 'mock-staff-1',
    'staff:businessId': 'mock-biz-2',
  },
  admin: {
    'admin:accessToken': 'dev-access-admin',
    'admin:refreshToken': 'dev-refresh-admin',
    'admin:adminId': 'mock-admin-1',
    'admin:role': 'super_admin',
  },
}

export async function seedDevMockSession(page: Page, portal: Portal): Promise<void> {
  await page.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v)
  }, DEV_MOCK_SESSION[portal])
}

/** Visible text of the page, for literal scans. */
export async function bodyText(page: Page): Promise<string> {
  return await page.evaluate(() => document.body.innerText)
}

export interface SensorMock {
  camera: 'grant' | 'deny'
  /** A fix to report, or 'deny' for a PERMISSION_DENIED error. */
  geo: { lat: number; lng: number; accuracy: number } | 'deny'
  /** iOS-style compass reading (`webkitCompassHeading` / `webkitCompassAccuracy`). */
  heading: { deg: number; accuracy: number }
}

/**
 * Replace the camera, geolocation and compass before the app boots. Camera
 * frames come from a 4px canvas; nothing real is opened. Must be called before
 * `page.goto`.
 */
export async function mockSensors(page: Page, mock: SensorMock): Promise<void> {
  await page.addInitScript((cfg: SensorMock) => {
    const getUserMedia = async (): Promise<MediaStream> => {
      if (cfg.camera === 'deny') throw new DOMException('Permission denied', 'NotAllowedError')
      const canvas = document.createElement('canvas')
      canvas.width = 4
      canvas.height = 4
      canvas.getContext('2d')?.fillRect(0, 0, 4, 4)
      return canvas.captureStream(1)
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices: async () => [],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    })

    const denied = {
      code: 1,
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }
    const fix = (): GeolocationPosition => {
      const g = cfg.geo as { lat: number; lng: number; accuracy: number }
      return {
        coords: {
          latitude: g.lat,
          longitude: g.lng,
          accuracy: g.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition
    }
    const report = (ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      if (cfg.geo === 'deny') fail?.(denied as unknown as GeolocationPositionError)
      else ok(fix())
    }
    const watches = new Map<number, number>()
    let nextWatch = 1
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback, fail?: PositionErrorCallback | null) => {
          window.setTimeout(() => report(ok, fail), 50)
        },
        watchPosition: (ok: PositionCallback, fail?: PositionErrorCallback | null) => {
          const id = nextWatch++
          window.setTimeout(() => report(ok, fail), 50)
          if (cfg.geo !== 'deny')
            watches.set(
              id,
              window.setInterval(() => report(ok, fail), 1000),
            )
          return id
        },
        clearWatch: (id: number) => {
          window.clearInterval(watches.get(id))
          watches.delete(id)
        },
      },
    })

    window.setInterval(() => {
      const ev = new Event('deviceorientation')
      Object.defineProperty(ev, 'webkitCompassHeading', { value: cfg.heading.deg })
      Object.defineProperty(ev, 'webkitCompassAccuracy', { value: cfg.heading.accuracy })
      window.dispatchEvent(ev)
    }, 100)
  }, mock)
}
