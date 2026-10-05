// @vitest-environment jsdom
/**
 * "Your glyph" on the consumer profile (glyphcity-rebrand task 3.2).
 *
 * The profile shows the label, the Glyph_Name and "Share my glyph", and never
 * a catalog description or taste-dimension bars. Network is stubbed; the
 * share path is driven through a mocked `navigator.share`.
 *
 * Validates: Requirements 3.2, 3.3
 */
import { ARCHETYPE_CATALOG, UNCHARTED_ARCHETYPE_ID } from '@area-code/shared/constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME } from '@area-code/shared/constants/brand'
import { useConsumerAuthStore } from '@area-code/shared/stores/consumerAuthStore'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { User } from '@area-code/shared/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@area-code/shared/hooks', () => ({ useUnclaimedRewards: () => ({ rewards: [] }) }))
vi.mock('@area-code/shared/lib/api', () => ({
  api: { get: vi.fn(() => new Promise(() => {})), post: vi.fn(), delete: vi.fn() },
}))
vi.mock('../../components/RankTrophyOverlay', () => ({ RankTrophyOverlay: () => null }))
vi.mock('../../components/ParkedCheckinsSection', () => ({ ParkedCheckinsSection: () => null }))

import { ProfileScreen } from '../ProfileScreen'

function makeUser(archetypeId?: string): User {
  return {
    id: 'user-1',
    username: 'nomvula',
    displayName: 'Nomvula',
    avatarUrl: null,
    tier: 'local',
    totalCheckIns: 3,
    archetypeId,
    dimensionScores: { energy: 0.9, cultural_rootedness: 0.8, sophistication: 0.2, edge: 0.5, spirituality: 0.1 },
  } as User
}

function renderProfile(archetypeId?: string) {
  useUserStore.setState({ user: makeUser(archetypeId), tier: 'local', totalCheckIns: 3, streakCount: 0 })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen onNavigate={vi.fn()} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  useConsumerAuthStore.setState({ isAuthenticated: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProfileScreen Your glyph', () => {
  it('shows the label, Glyph_Name and share control, never a description', () => {
    for (const archetype of ARCHETYPE_CATALOG) {
      const { container, unmount } = renderProfile(archetype.id)
      const card = container.querySelector('[data-your-glyph]')!
      expect(card.textContent).toContain('profile.yourGlyph')
      expect(card.querySelector('[data-glyph-name]')?.textContent).toBe(archetype.name)
      expect(screen.getByRole('button', { name: 'profile.shareMyGlyph' })).toBeTruthy()
      expect(container.innerHTML).not.toContain(archetype.description)
      unmount()
    }
  })

  it('shows The Uncharted when the user has no archetype, without its description', () => {
    const uncharted = ARCHETYPE_CATALOG.find((a) => a.id === UNCHARTED_ARCHETYPE_ID)!
    const { container } = renderProfile(undefined)
    expect(container.querySelector('[data-glyph-name]')?.textContent).toBe(uncharted.name)
    expect(container.innerHTML).not.toContain(uncharted.description)
  })

  it('renders no taste-dimension bars', () => {
    const { container } = renderProfile('archetype-firecracker')
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
    expect(container.textContent).not.toMatch(/cultural_rootedness|sophistication|spirituality/i)
  })

  it('shares the Glyph_Name with brand and domain, disabling the button while sharing', async () => {
    let resolveShare: () => void = () => {}
    const share = vi.fn(() => new Promise<void>((r) => (resolveShare = r)))
    vi.stubGlobal('navigator', { ...navigator, share })
    renderProfile('archetype-firecracker')
    const button = screen.getByRole('button', { name: 'profile.shareMyGlyph' }) as HTMLButtonElement

    fireEvent.click(button)
    expect(button.disabled).toBe(true)
    const payload = (share.mock.calls[0] as unknown as [{ text: string; url: string }])[0]
    expect(payload.text).toContain('The Firecracker')
    expect(payload.text).toContain(APP_NAME)
    expect(payload.url).toBe(`https://${APP_DOMAIN}`)

    await act(async () => {
      resolveShare()
    })
    expect(button.disabled).toBe(false)
  })
})
