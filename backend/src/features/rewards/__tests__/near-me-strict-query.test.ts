/**
 * `GET /v1/rewards/near-me` rejects any query key beyond `lat` and `lng`
 * (north-star-alignment R5.2). A `sort` key is a 400, so the one consumer
 * discovery read for gets cannot be asked to order by value or discount.
 *
 * Runs the real route and its preHandler chain through Fastify, with only the
 * Cognito verifier and the rewards service mocked.
 */

import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getRewardsNearMe: vi.fn(async () => ({ items: [] })),
}))

vi.mock('../service.js', () => ({ getRewardsNearMe: h.getRewardsNearMe }))

vi.mock('../../../shared/middleware/auth.js', () => ({
  requireAuth: () => async (request: { auth?: unknown }) => {
    request.auth = { userId: 'user-nomsa', role: 'consumer' }
  },
  getAuth: (request: { auth?: unknown }) => request.auth,
}))

import { rewardRoutes } from '../handler.js'

let app: FastifyInstance

beforeEach(async () => {
  h.getRewardsNearMe.mockClear()
  app = Fastify()
  await app.register(rewardRoutes)
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('GET /v1/rewards/near-me query (R5.2)', () => {
  it('answers a lat and lng request and passes the position to the service', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/rewards/near-me?lat=-26.2&lng=28.04' })

    expect(res.statusCode).toBe(200)
    expect(h.getRewardsNearMe).toHaveBeenCalledWith(-26.2, 28.04, 'user-nomsa')
  })

  it('rejects a sort key with 400 and never reaches the service', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/rewards/near-me?lat=-26.2&lng=28.04&sort=value' })

    expect(res.statusCode).toBe(400)
    expect(h.getRewardsNearMe).not.toHaveBeenCalled()
  })

  it('rejects any other unknown key with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/rewards/near-me?lat=-26.2&lng=28.04&discount=desc' })

    expect(res.statusCode).toBe(400)
  })
})
