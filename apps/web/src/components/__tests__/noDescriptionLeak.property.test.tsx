// @vitest-environment jsdom
/**
 * Feature: GlyphCity rebrand, Property 4: no description leak
 *
 * For any catalog whose archetype descriptions are random sentinel strings, no
 * consumer surface renders a description substring: not in markup, not in an
 * aria-label, not in the accessible node name and not in the share payload.
 * The catalog objects are mutated in place per run (every surface reads the
 * same exported array) and restored after.
 *
 * Validates: Requirements 3.3, 3.4
 */
import { ARCHETYPE_CATALOG } from '@area-code/shared/constants/archetype-catalog'
import { accessibleNodeName } from '@area-code/shared/lib/accessibleNodeName'
import { buildGlyphShareContent } from '@area-code/shared/lib/glyphShare'
import { useConsumerAuthStore } from '@area-code/shared/stores/consumerAuthStore'
import { useLocationStore } from '@area-code/shared/stores/locationStore'
import { useMapStore } from '@area-code/shared/stores/mapStore'
import { usePresenceStore } from '@area-code/shared/stores/presenceStore'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { Node, NodeState, User } from '@area-code/shared/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import fc from 'fast-check'
import type { ReactElement } from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NODE_ID = 'node-1'

const { route } = vi.hoisted(() => ({
  route: { archetypeId: 'archetype-township-royal', crowdNames: [] as string[] },
}))

function apiGet(url: string): Promise<unknown> {
  if (url.includes('/crowd-vibe')) {
    const archetypePercentages = Object.fromEntries(route.crowdNames.map((n) => [n, 5]))
    return Promise.resolve({ totalCheckedIn: 5, genreCounts: { amapiano: 3 }, archetypePercentages })
  }
  if (url.startsWith('/v1/nodes/trending')) {
    return Promise.resolve({
      items: [{ name: 'Fox Street Yard', area: 'Johannesburg', state: 'popping', checkIns: 12, category: 'nightlife' }],
    })
  }
  if (url.startsWith('/v1/leaderboard/')) {
    return Promise.resolve({
      entries: [{ userId: 'user-1', rank: 1, checkInCount: 4, tier: 'local', isFriend: true, username: 'nomvula' }],
      userRank: { rank: 1, checkInCount: 4 },
      segment: 'archetype',
    })
  }
  if (url.startsWith('/v1/feed')) {
    return Promise.resolve({
      items: [
        {
          id: 'feed-1',
          feedType: 'checkin',
          checkedInAt: new Date().toISOString(),
          user: {
            id: 'user-2',
            username: 'thabo',
            displayName: 'Thabo',
            avatarUrl: null,
            tier: 'local',
            archetypeId: route.archetypeId,
          },
          node: { id: NODE_ID, name: 'Fox Street Yard', slug: 'fox-street-yard', category: 'nightlife' },
        },
      ],
      nextCursor: null,
      hasMore: false,
    })
  }
  if (url.startsWith('/v1/rewards/near-me')) return Promise.resolve([])
  // Anything else stays pending: no network, no surface depends on it here.
  return new Promise(() => {})
}

vi.mock('@area-code/shared/lib/api', () => ({
  api: {
    get: (url: string) => apiGet(url),
    post: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({})),
  },
}))
vi.mock('@area-code/shared/lib/rum', () => ({ recordEvent: vi.fn() }))
vi.mock('@area-code/shared/hooks', () => ({ useUnclaimedRewards: () => ({ rewards: [] }) }))
// Not glyph surfaces; stubbed for the same reasons as the per-surface tests.
vi.mock('../RankTrophyOverlay', () => ({ RankTrophyOverlay: () => null }))
vi.mock('../ParkedCheckinsSection', () => ({ ParkedCheckinsSection: () => null }))
vi.mock('../QrScannerSheet', () => ({ QrScannerSheet: () => null }))
vi.mock('../DirectionsSheet', () => ({ DirectionsSheet: () => null }))

import { AuthLanding } from '../../screens/AuthLanding'
import { FeedScreen } from '../../screens/FeedScreen'
import { LeaderboardScreen } from '../../screens/LeaderboardScreen'
import { ProfileScreen } from '../../screens/ProfileScreen'
import { CrowdVibeSection } from '../CrowdVibeSection'
import { FeedItemRow } from '../FeedItemRow'
import { GlyphNameplate } from '../GlyphNameplate'
import { NodeDetailContent } from '../NodeDetailContent'
import { VenueCard } from '../VenueCard'

const ORIGINAL_DESCRIPTIONS = ARCHETYPE_CATALOG.map((a) => a.description)
const ARCHETYPE_IDS = ARCHETYPE_CATALOG.map((a) => a.id)
const STATES: NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']

const NODE = {
  id: NODE_ID,
  slug: 'fox-street-yard',
  name: 'Fox Street Yard',
  category: 'nightlife',
  lat: -26.2,
  lng: 28.04,
  claimStatus: 'claimed',
} as Node

function setDescriptions(descriptions: readonly string[]) {
  ARCHETYPE_CATALOG.forEach((a, i) => {
    a.description = descriptions[i]!
  })
}

function withQuery(ui: ReactElement): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

/** Markup (attributes included) plus every aria-label, across portals. */
function renderedText(): string {
  const labels = Array.from(document.body.querySelectorAll('[aria-label]')).map(
    (el) => el.getAttribute('aria-label') ?? '',
  )
  return `${document.body.innerHTML}\n${labels.join('\n')}`
}

function expectNoSentinel(text: string, sentinels: readonly string[], surface: string) {
  for (const s of sentinels) {
    expect(text.includes(s), `${surface} rendered description sentinel ${s}`).toBe(false)
  }
}

/** Render, optionally wait for async content, check, unmount. */
async function checkSurface(
  surface: string,
  ui: ReactElement,
  sentinels: readonly string[],
  ready?: () => void,
): Promise<void> {
  const view = render(ui)
  if (ready) await waitFor(ready)
  expectNoSentinel(renderedText(), sentinels, surface)
  view.unmount()
}

function seedStores(archetypeId: string) {
  usePresenceStore.getState().clear()
  useLocationStore.setState({ geoStatus: 'idle' })
  useConsumerAuthStore.setState({ isAuthenticated: true })
  useMapStore.setState({
    archetypeIds: { [NODE_ID]: archetypeId },
    archetypeBranches: {},
    pulseScores: { [NODE_ID]: 80 },
    checkInCounts: { [NODE_ID]: 12 },
    friendsAtVenue: {},
  })
  const user = {
    id: 'user-1',
    username: 'nomvula',
    displayName: 'Nomvula',
    avatarUrl: null,
    tier: 'local',
    totalCheckIns: 3,
    citySlug: 'johannesburg',
    archetypeId,
  } as User
  useUserStore.setState({ user, tier: 'local', totalCheckIns: 3, streakCount: 0 })
}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})

afterEach(() => {
  cleanup()
  setDescriptions(ORIGINAL_DESCRIPTIONS)
  vi.unstubAllGlobals()
})

afterAll(() => {
  setDescriptions(ORIGINAL_DESCRIPTIONS)
})

/** Sentinels: index-tagged so they are unique, hex tail so they never match real copy. */
const sentinelsArb = fc
  .array(fc.stringMatching(/^[0-9a-f]{12,20}$/), {
    minLength: ARCHETYPE_CATALOG.length,
    maxLength: ARCHETYPE_CATALOG.length,
  })
  .map((tails) => tails.map((tail, i) => `DESC_${i}_${tail}`))

describe('Feature: GlyphCity rebrand, Property 4: no description leak', () => {
  it('never renders a catalog description on any consumer surface', async () => {
    await fc.assert(
      fc.asyncProperty(
        sentinelsArb,
        fc.constantFrom(...ARCHETYPE_IDS),
        fc.constantFrom(...STATES),
        async (sentinels, archetypeId, state) => {
          setDescriptions(sentinels)
          route.archetypeId = archetypeId
          route.crowdNames = ARCHETYPE_CATALOG.map((a) => a.name)
          seedStores(archetypeId)
          const vm = {
            id: NODE_ID,
            name: NODE.name,
            liveCheckInCount: 12,
            pulseState: state,
            archetypeId,
            isFirstIn: state === 'dormant',
          }

          try {
            // Pure outputs.
            for (const id of ARCHETYPE_IDS) {
              const name = accessibleNodeName(NODE, id, state, 12, (_k, d) => d)
              expectNoSentinel(name, sentinels, 'accessibleNodeName')
              expectNoSentinel(JSON.stringify(buildGlyphShareContent(id)), sentinels, 'buildGlyphShareContent')
            }

            await checkSurface('VenueCard active', <VenueCard vm={vm} category="nightlife" isActive />, sentinels)
            await checkSurface('VenueCard inactive', <VenueCard vm={vm} category="nightlife" />, sentinels)
            await checkSurface(
              'GlyphNameplate',
              <GlyphNameplate archetypeId={archetypeId} pulseState={state} category="nightlife" size={40} />,
              sentinels,
            )
            await checkSurface(
              'NodeDetailContent',
              <NodeDetailContent
                node={NODE}
                rewards={[]}
                pulseScore={80}
                state={state}
                onCheckIn={vi.fn()}
                onSignIn={vi.fn()}
              />,
              sentinels,
            )
            await checkSurface('CrowdVibeSection', <CrowdVibeSection nodeId={NODE_ID} />, sentinels, () => {
              expect(document.body.textContent).toContain('crowdVibe.title')
            })
            await checkSurface(
              'FeedItemRow',
              <FeedItemRow
                item={{
                  id: 'feed-1',
                  feedType: 'checkin',
                  checkedInAt: new Date().toISOString(),
                  user: { id: 'user-2', username: 'thabo', displayName: 'Thabo', avatarUrl: null, tier: 'local' },
                  node: { id: NODE_ID, name: NODE.name, slug: NODE.slug, category: 'nightlife' },
                  venuePulseState: state,
                  venueCheckInCount: 12,
                  venueArchetypeId: archetypeId,
                  friendStillPresent: true,
                }}
                onFocusVenue={vi.fn()}
              />,
              sentinels,
            )
            await checkSurface('ProfileScreen', withQuery(<ProfileScreen onNavigate={vi.fn()} />), sentinels, () => {
              expect(document.body.querySelector('[data-your-glyph]')).toBeTruthy()
            })
            await checkSurface('FeedScreen', withQuery(<FeedScreen onNavigate={vi.fn()} />), sentinels, () => {
              expect(document.body.textContent).toContain('thabo')
            })
            await checkSurface(
              'LeaderboardScreen',
              withQuery(<LeaderboardScreen onNavigate={vi.fn()} />),
              sentinels,
              () => {
                expect(document.body.textContent).toContain('nomvula')
              },
            )
            await checkSurface('AuthLanding', withQuery(<AuthLanding onNavigate={vi.fn()} />), sentinels, () => {
              expect(document.body.textContent).toContain('Fox Street Yard')
            })
          } finally {
            cleanup()
            setDescriptions(ORIGINAL_DESCRIPTIONS)
          }
        },
      ),
      { numRuns: 100 },
    )
  }, 300_000)
})
