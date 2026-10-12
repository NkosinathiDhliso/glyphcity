/**
 * The Order_Preference on the client (vibe-order-toggle R2.3, R3.2): the store
 * holds it for every visitor, a signed-in choice goes to the record with one
 * PATCH, a failed save keeps the local choice and says so, and the login
 * reconcile lets a stored choice win or pushes the local one up once.
 */
import { DEFAULT_ORDER_MODE } from '@area-code/shared/constants/ranking'
import { useErrorStore } from '@area-code/shared/stores/errorStore'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { User } from '@area-code/shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({ patch: vi.fn() }))
vi.mock('@area-code/shared/lib/api', () => ({ api: apiMock }))

import { chooseOrderMode, reconcileOrderMode } from '../orderModePreference'

const t = (_key: string, en: string) => en
let userSeq = 0

function makeUser(overrides: Partial<User> = {}): User {
  userSeq += 1
  return {
    id: `u-${userSeq}`,
    phone: null,
    username: 'thandi',
    displayName: 'Thandi',
    avatarUrl: null,
    cityId: null,
    neighbourhoodId: null,
    tier: 'local',
    totalCheckIns: 0,
    cognitoSub: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as User
}

beforeEach(() => {
  apiMock.patch.mockReset()
  apiMock.patch.mockResolvedValue({})
  useUserStore.setState({ user: null, orderMode: DEFAULT_ORDER_MODE })
  useErrorStore.setState({ error: null })
})

describe('order preference store', () => {
  it('reads busy when nothing is set', () => {
    expect(useUserStore.getState().orderMode).toBe('busy')
  })

  it('keeps the choice across a logout', () => {
    useUserStore.setState({ user: makeUser(), orderMode: 'crowd' })

    useUserStore.getState().clearUser()

    expect(useUserStore.getState().orderMode).toBe('crowd')
  })
})

describe('chooseOrderMode', () => {
  it('applies the choice and sends nothing while logged out', async () => {
    await chooseOrderMode('crowd', t)

    expect(useUserStore.getState().orderMode).toBe('crowd')
    expect(apiMock.patch).not.toHaveBeenCalled()
  })

  it('saves a signed-in choice with one PATCH', async () => {
    useUserStore.setState({ user: makeUser() })

    await chooseOrderMode('crowd', t)

    expect(apiMock.patch).toHaveBeenCalledTimes(1)
    expect(apiMock.patch).toHaveBeenCalledWith('/v1/users/me', { orderMode: 'crowd' })
    expect(useUserStore.getState().user?.orderMode).toBe('crowd')
  })

  it('keeps the local choice and says so when the save fails', async () => {
    useUserStore.setState({ user: makeUser() })
    apiMock.patch.mockRejectedValue(new Error('offline'))

    await chooseOrderMode('crowd', t)

    expect(useUserStore.getState().orderMode).toBe('crowd')
    expect(useErrorStore.getState().error).toBe("Couldn't save your order choice")
  })
})

describe('reconcileOrderMode', () => {
  it('lets a stored choice win over the local one', async () => {
    useUserStore.setState({ orderMode: 'busy' })

    await reconcileOrderMode(makeUser({ orderMode: 'crowd' }), t)

    expect(useUserStore.getState().orderMode).toBe('crowd')
    expect(apiMock.patch).not.toHaveBeenCalled()
  })

  it('pushes the local choice up when the record has none', async () => {
    const user = makeUser()
    useUserStore.setState({ user, orderMode: 'crowd' })

    await reconcileOrderMode(user, t)

    expect(apiMock.patch).toHaveBeenCalledWith('/v1/users/me', { orderMode: 'crowd' })
  })

  it('runs once per user, so a later refresh does not undo a failed save', async () => {
    const user = makeUser({ orderMode: 'busy' })
    await reconcileOrderMode(user, t)
    useUserStore.setState({ orderMode: 'crowd' })

    await reconcileOrderMode(user, t)

    expect(useUserStore.getState().orderMode).toBe('crowd')
  })
})
