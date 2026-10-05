/**
 * Acquisition_Source is written once, at sign-up (GlyphCity rebrand R10.3,
 * task 13.1).
 *
 *  - email sign-up stores the source the client sent
 *  - Google sign-in stores it only when the sync creates the account; a
 *    returning user is never re-attributed
 *  - a missing source reads as `organic`, and an unknown value is refused
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserByCognitoSub: vi.fn(),
  getCityBySlug: vi.fn(),
  findUserByUsername: vi.fn(),
  insertConsentRecord: vi.fn(),
}))

vi.mock('../../../shared/config/env.js', () => ({
  DEV_MODE: false,
  AWS_REGION: 'af-south-1',
  webBaseUrl: () => 'https://example.test',
}))
vi.mock('../../../shared/kv/dynamodb-kv.js', () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
  kvIncr: vi.fn(),
}))
vi.mock('../../../shared/email/ses.js', () => ({ sendEmailVerificationEmail: vi.fn() }))
vi.mock('../../../shared/sms/feedback.js', () => ({ reportOtpFeedback: vi.fn() }))
vi.mock('../../business/repository.js', () => ({ findBusinessByCognitoSub: vi.fn() }))
vi.mock('../dynamodb-repository.js', () => ({ updateBusiness: vi.fn() }))
vi.mock('../profile-service.js', () => ({ currentConsentVersion: () => 'v1' }))
vi.mock('../../../shared/cognito/client.js', () => ({
  UsernameTakenError: class extends Error {},
  createEmailPasswordUser: vi.fn().mockResolvedValue({ sub: 'sub-new' }),
  updateUserAttributes: vi.fn(),
  updateUserAttributesByCognitoSub: vi.fn(),
  passwordAuth: vi.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  deleteUserByUsername: vi.fn(),
  getVerifiedEmailBySub: vi.fn(),
}))
vi.mock('../repository.js', () => ({
  createUser: mocks.createUser,
  getUserByEmail: mocks.getUserByEmail,
  getUserByCognitoSub: mocks.getUserByCognitoSub,
  getCityBySlug: mocks.getCityBySlug,
  findUserByUsername: mocks.findUserByUsername,
  insertConsentRecord: mocks.insertConsentRecord,
  deleteUser: vi.fn(),
  relinkCognitoSub: vi.fn(),
  linkCognitoSub: vi.fn(),
}))

import { consumerEmailSignup, consumerOAuthSync } from '../service.js'
import { consumerEmailSignupBodySchema, consumerOAuthSyncBodySchema } from '../types.js'

const NEW_USER = { userId: 'u1', username: 'thandi', displayName: 'Thandi', tier: 'local' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUserByEmail.mockResolvedValue(null)
  mocks.getUserByCognitoSub.mockResolvedValue(null)
  mocks.getCityBySlug.mockResolvedValue({ id: 'city-jhb' })
  mocks.findUserByUsername.mockResolvedValue(null)
  mocks.createUser.mockResolvedValue(NEW_USER)
})

describe('email sign-up', () => {
  it('stores the first-touch source', async () => {
    await consumerEmailSignup({ email: 'thandi@example.test', password: 'long-enough', acquisitionSource: 'creator' })
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ acquisitionSource: 'creator' }))
  })
})

describe('Google sign-in sync', () => {
  it('stores the source when the sync creates the account', async () => {
    await consumerOAuthSync({
      cognitoSub: 'sub-new',
      email: 'thandi@example.test',
      userAgent: 'test',
      acquisitionSource: 'share',
    })
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ acquisitionSource: 'share' }))
  })

  it('never re-attributes a returning user', async () => {
    mocks.getUserByCognitoSub.mockResolvedValue({ ...NEW_USER, acquisitionSource: 'organic' })
    await consumerOAuthSync({ cognitoSub: 'sub-new', userAgent: 'test', acquisitionSource: 'creator' })
    expect(mocks.createUser).not.toHaveBeenCalled()
  })
})

describe('request schemas', () => {
  it('read a missing source as organic', () => {
    expect(
      consumerEmailSignupBodySchema.parse({ email: 'a@example.test', password: 'long-enough' }).acquisitionSource,
    ).toBe('organic')
    expect(consumerOAuthSyncBodySchema.parse(undefined)).toEqual({ acquisitionSource: 'organic' })
    expect(consumerOAuthSyncBodySchema.parse({})).toEqual({ acquisitionSource: 'organic' })
  })

  it('refuse an unknown source', () => {
    expect(consumerOAuthSyncBodySchema.safeParse({ acquisitionSource: 'billboard' }).success).toBe(false)
  })
})
