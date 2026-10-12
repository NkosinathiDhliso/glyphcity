// @vitest-environment jsdom
/**
 * Ranks count rooms, and empty states point to the map
 * (north-star-alignment R2.2, R2.4, task 3.5).
 *
 * The api is mocked per test; react-i18next is not initialised, so `t` returns
 * the inline English fallbacks asserted here.
 */
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { User } from '@area-code/shared/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('@area-code/shared/lib/api', () => ({ api: { get: (url: string) => apiGet(url) } }))

import { LeaderboardScreen } from '../LeaderboardScreen'

const VIEWER = { id: 'user-me', displayName: 'Me', tier: 'local', archetypeId: undefined, citySlug: 'johannesburg' }

function row(userId: string, rank: number, venueCount: number, checkInCount: number) {
  return {
    userId,
    username: null,
    displayName: null,
    avatarUrl: null,
    tier: 'local',
    rank,
    venueCount,
    checkInCount,
    isFriend: false,
  }
}

function renderScreen(onNavigate = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <LeaderboardScreen onNavigate={onNavigate} />
    </QueryClientProvider>,
  )
  return onNavigate
}

beforeEach(() => {
  apiGet.mockReset()
  useUserStore.setState({ user: VIEWER as unknown as User })
})

afterEach(() => {
  cleanup()
})

describe('LeaderboardScreen (north-star-alignment R2)', () => {
  it('leads each row with rooms', async () => {
    apiGet.mockResolvedValue({ entries: [row('user-a', 1, 4, 9)], userRank: null, segment: 'city-wide' })
    renderScreen()

    const rooms = await screen.findAllByTestId('leaderboard-rooms')
    expect(rooms[0]!.textContent).toContain('4')
  })

  it('gives a viewer with no check-in this week a map pointer and no share button', async () => {
    apiGet.mockResolvedValue({ entries: [row('user-a', 1, 4, 9)], userRank: null, segment: 'city-wide' })
    const onNavigate = renderScreen()

    const you = await screen.findByTestId('leaderboard-you')
    expect(you.textContent).toContain('Not on the board yet. Open the map.')
    expect(within(you).queryByRole('button', { name: /share/i })).toBeNull()
    expect(you.textContent).not.toMatch(/to (reach|unlock)|more check-ins? to/i)

    fireEvent.click(within(you).getByRole('button', { name: 'Map' }))
    expect(onNavigate).toHaveBeenCalledWith('map')
  })

  it('shows a ranked viewer their rank, rooms and the share button', async () => {
    apiGet.mockResolvedValue({
      entries: [row('user-a', 1, 4, 9)],
      userRank: { rank: 12, venueCount: 2, checkInCount: 3 },
      segment: 'city-wide',
    })
    renderScreen()

    const you = await screen.findByTestId('leaderboard-you')
    expect(you.textContent).toContain('12')
    expect(within(you).getByRole('button', { name: /share/i })).toBeTruthy()
  })

  it('points an empty board to the map', async () => {
    apiGet.mockResolvedValue({ entries: [], userRank: null, segment: 'city-wide' })
    const onNavigate = renderScreen()

    const empty = await screen.findByTestId('leaderboard-empty')
    fireEvent.click(within(empty).getByRole('button', { name: 'Map' }))
    expect(onNavigate).toHaveBeenCalledWith('map')
  })
})
