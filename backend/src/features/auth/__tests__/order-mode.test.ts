/**
 * The Order_Preference on the user record (vibe-order-toggle R3.1, R3.2).
 *
 *  - the profile PATCH accepts `busy` and `crowd` and refuses anything else
 *    (the validate middleware turns that refusal into a 400)
 *  - a PATCH writes it to the record and a GET returns it
 *  - the gets feed reads an unset mode as `busy`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateUserProfile: vi.fn(),
  getUserByCognitoSub: vi.fn(),
  getCityBySlug: vi.fn(),
}))

vi.mock('../../../shared/config/env.js', () => ({
  DEV_MODE: false,
  requireEnv: (_name: string, devDefault: string) => devDefault,
}))
vi.mock('../../../shared/kv/dynamodb-kv.js', () => ({ kvGet: vi.fn(), kvSet: vi.fn(), kvDel: vi.fn() }))
vi.mock('../repository.js', () => ({
  updateUserProfile: mocks.updateUserProfile,
  getUserByCognitoSub: mocks.getUserByCognitoSub,
  getCityBySlug: mocks.getCityBySlug,
}))

import { AppError } from '../../../shared/errors/AppError.js'
import { validate } from '../../../shared/middleware/validation.js'
import { rankGetsByVibe, type GetRankSignals } from '../../rewards/ranking.js'
import { getUserProfile, updateProfile } from '../profile-service.js'
import { updateProfileBodySchema } from '../types.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('profile PATCH schema: orderMode', () => {
  it.each(['busy', 'crowd'])('accepts %s', (orderMode) => {
    expect(updateProfileBodySchema.safeParse({ orderMode }).success).toBe(true)
  })

  it.each(['nearest', '', 'BUSY', 1, null])('refuses %p', (orderMode) => {
    expect(updateProfileBodySchema.safeParse({ orderMode }).success).toBe(false)
  })

  it('surfaces an unknown value as a 400', async () => {
    const check = validate({ body: updateProfileBodySchema })
    const request = { body: { orderMode: 'nearest' } } as never

    await expect(check(request, {} as never)).rejects.toMatchObject({ statusCode: 400 })
    await expect(check(request, {} as never)).rejects.toBeInstanceOf(AppError)
  })
})

describe('profile service: orderMode', () => {
  it('writes the mode to the user record', async () => {
    mocks.updateUserProfile.mockResolvedValue({ userId: 'u1', orderMode: 'crowd' })

    await updateProfile('u1', { orderMode: 'crowd' })

    expect(mocks.updateUserProfile).toHaveBeenCalledWith('u1', { orderMode: 'crowd' })
  })

  it('leaves the mode alone when the PATCH does not carry it', async () => {
    mocks.updateUserProfile.mockResolvedValue({ userId: 'u1' })

    await updateProfile('u1', { displayName: 'Thandi' })

    expect(mocks.updateUserProfile).toHaveBeenCalledWith('u1', { displayName: 'Thandi' })
  })

  it('returns the stored mode on GET', async () => {
    mocks.getUserByCognitoSub.mockResolvedValue({ id: 'u1', userId: 'u1', orderMode: 'crowd' })

    await expect(getUserProfile('sub-1')).resolves.toMatchObject({ orderMode: 'crowd' })
  })
})

describe('gets feed: an unset mode reads as busy', () => {
  it('orders the buzzing get first when no mode is passed', () => {
    const base = { tierMultiplier: 1, hasLiveGets: false, distanceMeters: 100 }
    const onTaste: GetRankSignals = { ...base, id: 'on-taste', tasteMatch: 2, aliveness: 1 }
    const buzzing: GetRankSignals = { ...base, id: 'buzzing', tasteMatch: 0, aliveness: 50 }

    expect(rankGetsByVibe([onTaste, buzzing]).map((g) => g.id)).toEqual(['buzzing', 'on-taste'])
  })
})
