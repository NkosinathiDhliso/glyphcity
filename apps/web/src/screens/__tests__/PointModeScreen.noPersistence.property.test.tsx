// @vitest-environment jsdom
/**
 * Feature: GlyphCity rebrand, Property 9: no persistence.
 *
 * A simulated Point_Mode session (position fixes, including bad-accuracy ones
 * that trip the signal fallback, compass samples, beam and label taps, close,
 * hidden tab, reopen) runs against the real PointModeEntry, PointModeScreen and
 * usePointModeSensors with the flag on. Across the whole session:
 *
 * - no API write, non-GET fetch, beacon, Web Storage or safeStorage write,
 *   IndexedDB open or WebSocket send happens;
 * - usage and RUM events carry no generated lat, lng or heading;
 * - storage holds no key naming a position or heading;
 * - every camera track is stopped and every position watch cleared after
 *   close, hidden tab and unmount;
 * - an open venue card says "Camera stays on your phone".
 *
 * Selecting a venue writes the in-memory `selectionStore`; that is not storage.
 *
 * Out of scope: check-in. It is the map's proximity flow, which sends position
 * for verification by design (R8.4), so the session never taps "Check in".
 *
 * **Validates: Requirements 8.7**
 */
import { api } from '@area-code/shared/lib/api'
import { clearFeatureFlagOverrides, setFeatureFlagOverride } from '@area-code/shared/lib/featureGating'
import { bearingTo } from '@area-code/shared/lib/pointMode/geometry'
import { compassHeadingFromEuler } from '@area-code/shared/lib/pointMode/heading'
import { useLocationStore, useMapStore, useSelectionStore } from '@area-code/shared/stores'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { Node, NodeCategory } from '@area-code/shared/types'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import fc from 'fast-check'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PointModeEntry } from '../../components/PointModeEntry'

// ── Mutable mock state shared with the module factories ──
const h = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  recordEvent: vi.fn(),
  safeWrites: [] as unknown[][],
}))

vi.mock('mapbox-gl', () => ({ default: { Marker: class {}, Map: class {} } }))
// A stable `t`, as the initialised i18next instance gives in the app (effects key on it).
vi.mock('react-i18next', () => {
  const t = (key: string, arg?: unknown): string => {
    if (typeof arg === 'string') return arg
    const opts = (arg ?? {}) as Record<string, unknown>
    const text = typeof opts['defaultValue'] === 'string' ? opts['defaultValue'] : key
    return text.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(opts[name] ?? ''))
  }
  const value = { t, i18n: { language: 'en' } }
  return { useTranslation: () => value }
})
vi.mock('@area-code/shared/lib/usageEvents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@area-code/shared/lib/usageEvents')>()),
  trackEvent: h.trackEvent,
}))
vi.mock('@area-code/shared/lib/rum', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@area-code/shared/lib/rum')>()),
  recordEvent: h.recordEvent,
}))
vi.mock('@area-code/shared/lib/safeStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@area-code/shared/lib/safeStorage')>()
  return {
    ...actual,
    writeStored: (...args: Parameters<typeof actual.writeStored>) => {
      h.safeWrites.push(['writeStored', ...args])
      return actual.writeStored(...args)
    },
    writeStoredJson: (...args: Parameters<typeof actual.writeStoredJson>) => {
      h.safeWrites.push(['writeStoredJson', ...args])
      return actual.writeStoredJson(...args)
    },
  }
})

// ── Fixtures ──
const ORIGIN = { lat: -26.2041, lng: 28.0473 }
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180)
const CATEGORIES: NodeCategory[] = ['food', 'coffee', 'nightlife', 'retail', 'fitness', 'arts']
const PRIVACY_COPY = 'Camera stays on your phone'
const LOCATION_KEY = /lat|lng|lon|heading|position|coords|geo/i

function offset(dx: number, dy: number): { lat: number; lng: number } {
  return { lat: ORIGIN.lat + dy / M_PER_DEG_LAT, lng: ORIGIN.lng + dx / M_PER_DEG_LNG }
}

function makeNode(i: number, dx: number, dy: number, category: NodeCategory): Node {
  const id = `v${i}`
  return {
    id,
    name: `Venue ${id}`,
    slug: id,
    category,
    ...offset(dx, dy),
    cityId: 'johannesburg',
    businessId: `b-${id}`,
    submittedBy: null,
    claimStatus: 'claimed',
    claimCipcStatus: null,
    nodeColour: '#000000',
    nodeIcon: null,
    qrCheckinEnabled: true,
    isVerified: true,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    businessTier: 'starter',
    boostActive: false,
  } as Node
}

// ── Generators ──
const metres = (max: number) => fc.double({ min: -max, max, noNaN: true })

const venueArb = fc.record({
  dx: metres(180),
  dy: metres(180),
  pulse: fc.integer({ min: 0, max: 80 }),
  count: fc.integer({ min: 0, max: 30 }),
  category: fc.constantFrom(...CATEGORIES),
})

const actionArb = fc.oneof(
  { weight: 2, arbitrary: fc.constant({ kind: 'open' as const }) },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('fix' as const),
      dx: metres(40),
      dy: metres(40),
      // Good fixes and fixes worse than the 35 m gate.
      accuracy: fc.oneof(fc.double({ min: 3, max: 30, noNaN: true }), fc.double({ min: 40, max: 150, noNaN: true })),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('android' as const),
      alpha: fc.double({ min: 0, max: 359.9, noNaN: true }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('ios' as const),
      // Aim at a venue so beams land in frame, plus a jitter.
      venueIdx: fc.nat(),
      jitter: fc.double({ min: -10, max: 10, noNaN: true }),
      accuracy: fc.oneof(fc.double({ min: 2, max: 20, noNaN: true }), fc.double({ min: 30, max: 60, noNaN: true })),
    }),
  },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('tapBeam' as const), pick: fc.nat() }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('tapLabel' as const), pick: fc.nat() }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'close' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'hide' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'reopen' as const }) },
)

const sessionArb = fc.record({
  venues: fc.array(venueArb, { minLength: 1, maxLength: 5 }),
  actions: fc.array(actionArb, { minLength: 1, maxLength: 14 }),
})

type Session = typeof sessionArb extends fc.Arbitrary<infer S> ? S : never
type Action = Session['actions'][number]

// ── Browser edges ──
interface FakeTrack {
  stop: ReturnType<typeof vi.fn>
}
interface Watch {
  success: PositionCallback
  error?: PositionErrorCallback | null
}

const env = {
  tracks: [] as FakeTrack[],
  watches: new Map<number, Watch>(),
  createdWatches: new Set<number>(),
  clearedWatches: new Set<number>(),
  nextWatchId: 1,
  raf: new Map<number, FrameRequestCallback>(),
  nextRaf: 1,
  fetchCalls: [] as { url: string; method: string; body: unknown }[],
  wsSends: [] as unknown[],
  setItem: null as ReturnType<typeof vi.spyOn> | null,
  idbOpen: vi.fn(),
  sendBeacon: vi.fn(() => true),
}

function defineGlobal(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, configurable: true, writable: true })
}

function installBrowserEdges(): void {
  env.tracks = []
  env.watches.clear()
  env.createdWatches.clear()
  env.clearedWatches.clear()
  env.raf.clear()
  env.fetchCalls = []
  env.wsSends = []
  env.idbOpen.mockClear()
  env.sendBeacon.mockClear()

  defineGlobal(navigator, 'mediaDevices', {
    getUserMedia: vi.fn(async () => {
      const track: FakeTrack = { stop: vi.fn() }
      env.tracks.push(track)
      return { getTracks: () => [track] } as unknown as MediaStream
    }),
  })
  defineGlobal(navigator, 'geolocation', {
    watchPosition: (success: PositionCallback, error?: PositionErrorCallback | null) => {
      const id = env.nextWatchId++
      env.watches.set(id, { success, error })
      env.createdWatches.add(id)
      return id
    },
    clearWatch: (id: number) => {
      env.clearedWatches.add(id)
      env.watches.delete(id)
    },
  })
  defineGlobal(navigator, 'sendBeacon', env.sendBeacon)
  defineGlobal(globalThis, 'indexedDB', { open: env.idbOpen })
  defineGlobal(globalThis, 'fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    env.fetchCalls.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase(), body: init?.body })
    return Promise.resolve(new Response('{}', { status: 200 }))
  })
  defineGlobal(
    globalThis,
    'WebSocket',
    class {
      send(data: unknown) {
        env.wsSends.push(data)
      }
      close() {}
      addEventListener() {}
      removeEventListener() {}
    },
  )
  defineGlobal(globalThis, 'requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = env.nextRaf++
    env.raf.set(id, cb)
    return id
  })
  defineGlobal(globalThis, 'cancelAnimationFrame', (id: number) => {
    env.raf.delete(id)
  })
  defineGlobal(window, 'matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
  defineGlobal(document, 'visibilityState', 'visible')
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  env.setItem = vi.spyOn(Storage.prototype, 'setItem')
}

/** One frame: the heading tick re-arms itself, so run only what is queued now. */
function flushFrame(): void {
  const queued = [...env.raf.entries()]
  env.raf.clear()
  for (const [, cb] of queued) cb(performance.now())
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

// ── Store reset ──
const INITIAL = {
  map: useMapStore.getState(),
  selection: useSelectionStore.getState(),
  location: useLocationStore.getState(),
  user: useUserStore.getState(),
}

function resetStores(): void {
  useMapStore.setState(INITIAL.map, true)
  useSelectionStore.setState(INITIAL.selection, true)
  useLocationStore.setState(INITIAL.location, true)
  useUserStore.setState(INITIAL.user, true)
}

function seedVenues(s: Session): Node[] {
  const nodes = s.venues.map((v, i) => makeNode(i, v.dx, v.dy, v.category))
  useMapStore.setState({
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    pulseScores: Object.fromEntries(nodes.map((n, i) => [n.id, s.venues[i]!.pulse])),
    checkInCounts: Object.fromEntries(nodes.map((n, i) => [n.id, s.venues[i]!.count])),
  })
  return nodes
}

function Harness({ onCheckIn }: { onCheckIn: () => void }) {
  const [open, setOpen] = useState(false)
  return <PointModeEntry open={open} onOpenChange={setOpen} onCheckIn={onCheckIn} isCheckingIn={false} />
}

// ── Leak checks ──
function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value)
  else if (typeof value === 'string') {
    for (const m of value.match(/-?\d+(?:\.\d+)?/g) ?? []) out.push(Number(m))
  } else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => numbersIn(v, out))
  return out
}

function expectNoLocationNumbers(payload: unknown, secrets: number[], where: string): void {
  for (const n of numbersIn(payload)) {
    for (const secret of secrets) {
      expect(Math.abs(n - secret) < 1e-4, `${where} carries ${n}`).toBe(false)
    }
  }
}

function expectSensorsReleased(where: string): void {
  for (const track of env.tracks) expect(track.stop, `${where}: track left running`).toHaveBeenCalled()
  expect(env.watches.size, `${where}: position watch left open`).toBe(0)
}

// ── Session runner ──
interface RunState {
  position: { lat: number; lng: number } | null
  secrets: number[]
  nodes: Node[]
}

/** Sanity counters so the property cannot pass by never reaching a placed beam. */
const coverage = { cards: 0 }

function pointModeRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.fixed.inset-0')
}

function buttonByText(text: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text)
}

async function step(action: Action, run: RunState): Promise<void> {
  switch (action.kind) {
    case 'open': {
      const control = document.querySelector<HTMLElement>('[aria-label="Point your camera at a street"]')
      if (control) fireEvent.click(control)
      await settle()
      return
    }
    case 'fix': {
      const pos = offset(action.dx, action.dy)
      run.position = pos
      run.secrets.push(pos.lat, pos.lng)
      for (const w of [...env.watches.values()]) {
        act(() => {
          w.success({
            coords: { latitude: pos.lat, longitude: pos.lng, accuracy: action.accuracy },
            timestamp: Date.now(),
          } as GeolocationPosition)
        })
      }
      return
    }
    case 'android': {
      run.secrets.push(action.alpha, compassHeadingFromEuler(action.alpha, 0, 0))
      const ev = Object.assign(new Event('deviceorientationabsolute'), {
        alpha: action.alpha,
        beta: 0,
        gamma: 0,
        absolute: true,
      })
      act(() => {
        window.dispatchEvent(ev)
        flushFrame()
      })
      return
    }
    case 'ios': {
      const target = run.nodes[action.venueIdx % run.nodes.length]!
      const from = run.position ?? ORIGIN
      const deg = (((bearingTo(from, target) + action.jitter) % 360) + 360) % 360
      run.secrets.push(deg)
      const ev = Object.assign(new Event('deviceorientation'), {
        webkitCompassHeading: deg,
        webkitCompassAccuracy: action.accuracy,
      })
      act(() => {
        window.dispatchEvent(ev)
        flushFrame()
      })
      return
    }
    case 'tapBeam':
    case 'tapLabel': {
      const root = pointModeRoot()
      if (!root) return
      const targets =
        action.kind === 'tapBeam'
          ? [...root.querySelectorAll<HTMLElement>('[data-layer="beam-hit"]')]
          : [...root.querySelectorAll<HTMLElement>('button[aria-pressed]')]
      if (targets.length === 0) return
      act(() => {
        fireEvent.click(targets[action.pick % targets.length]!)
      })
      // A selection with beams placed opens the card, which states the camera promise.
      if (useSelectionStore.getState().activeVenueId && !root.querySelector('[role="status"]')) {
        expect(root.textContent).toContain(PRIVACY_COPY)
        coverage.cards += 1
      }
      return
    }
    case 'close': {
      const back = document.querySelector<HTMLElement>('.fixed.inset-0 [aria-label="Back to map"]')
      if (!back) return
      act(() => {
        fireEvent.click(back)
      })
      expectSensorsReleased('close')
      return
    }
    case 'hide': {
      act(() => {
        defineGlobal(document, 'visibilityState', 'hidden')
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expectSensorsReleased('hidden tab')
      defineGlobal(document, 'visibilityState', 'visible')
      return
    }
    case 'reopen': {
      const resume = buttonByText('Resume') ?? buttonByText('Retry')
      if (resume) fireEvent.click(resume)
      else {
        const control = document.querySelector<HTMLElement>('[aria-label="Point your camera at a street"]')
        if (control) fireEvent.click(control)
      }
      await settle()
      return
    }
  }
}

function expectNoWrites(run: RunState): void {
  for (const method of ['post', 'put', 'patch', 'delete'] as const) {
    expect(api[method], `api.${method}`).not.toHaveBeenCalled()
  }
  expect(env.fetchCalls.filter((c) => c.method !== 'GET')).toEqual([])
  for (const call of env.fetchCalls) expectNoLocationNumbers(call.url, run.secrets, 'fetch GET')
  expect(env.sendBeacon).not.toHaveBeenCalled()
  expect(env.setItem).not.toHaveBeenCalled()
  expect(h.safeWrites).toEqual([])
  expect(env.idbOpen).not.toHaveBeenCalled()
  expect(env.wsSends).toEqual([])

  for (const call of [...h.trackEvent.mock.calls, ...h.recordEvent.mock.calls]) {
    expectNoLocationNumbers(call.slice(1), run.secrets, `event ${String(call[0])}`)
  }

  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      expect(LOCATION_KEY.test(store.key(i) ?? ''), `storage key ${store.key(i)}`).toBe(false)
    }
  }
}

describe('Feature: GlyphCity rebrand, Property 9: no persistence', () => {
  beforeEach(() => {
    resetStores()
    localStorage.clear()
    sessionStorage.clear()
    h.trackEvent.mockClear()
    h.recordEvent.mockClear()
    h.safeWrites.length = 0
    setFeatureFlagOverride('point_mode', true)
  })

  afterEach(() => {
    cleanup()
    clearFeatureFlagOverrides()
    vi.restoreAllMocks()
  })

  it('a simulated session makes no API or storage write and releases every sensor', async () => {
    await fc.assert(
      fc.asyncProperty(sessionArb, async (s) => {
        resetStores()
        localStorage.clear()
        sessionStorage.clear()
        h.trackEvent.mockClear()
        h.recordEvent.mockClear()
        h.safeWrites.length = 0
        vi.restoreAllMocks()
        installBrowserEdges()
        for (const method of ['post', 'put', 'patch', 'delete'] as const) {
          vi.spyOn(api, method).mockResolvedValue(undefined as never)
        }
        const onCheckIn = vi.fn()
        const run: RunState = { position: null, secrets: [], nodes: seedVenues(s) }

        render(<Harness onCheckIn={onCheckIn} />)
        // Every session starts from the user's tap on the camera control.
        await step({ kind: 'open' }, run)
        for (const action of s.actions) await step(action, run)

        expect(onCheckIn).not.toHaveBeenCalled()
        expectNoWrites(run)

        cleanup()
        expectSensorsReleased('unmount')
        for (const id of env.createdWatches) {
          expect(env.clearedWatches.has(id), `watch ${id} never cleared`).toBe(true)
        }
      }),
      { numRuns: 100 },
    )
    expect(coverage.cards, 'no session ever opened a venue card').toBeGreaterThan(0)
  })
})
