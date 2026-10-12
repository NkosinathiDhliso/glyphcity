/**
 * Feature: North star alignment, Property 5 (unit half): unlinking music
 * clears the taste fields and nothing else (north-star-alignment R6.3).
 *
 * No provider tokens are stored, so `clearUserMusicData` nulling the taste
 * fields on the user row is the whole deletion path. This pins exactly which
 * attributes it writes, so a later change cannot quietly widen it into a live
 * field (presence, check-ins, tier) or narrow it and leave taste behind.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ updateUser: vi.fn(async () => null) }))

vi.mock('../../auth/dynamodb-repository.js', () => ({
  updateUser: h.updateUser,
  getUserById: vi.fn(),
}))
vi.mock('../../check-in/dynamodb-repository.js', () => ({ getCheckInsByNode: vi.fn() }))

import { clearUserMusicData } from '../repository.js'

beforeEach(() => {
  h.updateUser.mockClear()
})

describe('clearUserMusicData (R6.3)', () => {
  it('writes the four taste attributes and no others', async () => {
    await clearUserMusicData('user-nomsa')

    expect(h.updateUser).toHaveBeenCalledTimes(1)
    const [userId, data] = h.updateUser.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(userId).toBe('user-nomsa')
    expect(Object.keys(data).sort()).toEqual(['archetypeId', 'dimensionScores', 'musicGenres', 'streamingProvider'])
  })

  it('clears each one to empty', async () => {
    await clearUserMusicData('user-nomsa')

    const [, data] = h.updateUser.mock.calls[0] as unknown as [string, Record<string, unknown>]
    expect(data).toEqual({ streamingProvider: null, musicGenres: [], dimensionScores: null, archetypeId: null })
  })
})
