import type { LeaderboardEntry } from '../../types'

import { MOCK_USERS, CURRENT_USER_ID } from './users'

// Friends of the current user (mock-user-4) for demo purposes
const FRIEND_IDS = new Set(['mock-user-1', 'mock-user-2', 'mock-user-7', CURRENT_USER_ID])

function userEntry(userId: string, rank: number, rooms: number, weeklyCount: number): LeaderboardEntry {
  const u = MOCK_USERS.find((u) => u.id === userId)!
  const isFriend = FRIEND_IDS.has(userId) || userId === CURRENT_USER_ID
  return {
    userId,
    username: isFriend ? u.username : null,
    displayName: isFriend ? u.displayName : null,
    avatarUrl: isFriend ? u.avatarUrl : null,
    tier: u.tier,
    rank,
    venueCount: rooms,
    checkInCount: weeklyCount,
    isFriend,
  }
}

/** Top 10 + current user entry. Sorted by rooms, then check-ins. */
export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  userEntry('mock-user-1', 1, 12, 42),
  userEntry('mock-user-14', 2, 11, 38),
  userEntry('mock-user-8', 3, 10, 31),
  userEntry('mock-user-2', 4, 9, 27),
  userEntry('mock-user-11', 5, 8, 22),
  userEntry('mock-user-3', 6, 7, 19),
  userEntry('mock-user-7', 7, 6, 16),
  userEntry('mock-user-12', 8, 6, 14),
  userEntry('mock-user-5', 9, 5, 11),
  userEntry('mock-user-9', 10, 4, 9),
  // Current user outside top 10
  userEntry(CURRENT_USER_ID, 12, 3, 6),
]

export const CURRENT_USER_RANK: number = 12
