/**
 * "Tonight at a place you know" (north-star-alignment R3.2, R3.3, task 5.3, 5.4).
 *
 * Feature: North star alignment, Property 2: `pickTonightVenue` returns null
 * when no visited venue has a Tonight, never a venue the guest marked going
 * for, and otherwise the earliest such venue in visit order.
 *
 * The handler half runs the real worker with its reads mocked, to pin the
 * read bounds (90 days, 200 check-ins, 10 venues), the opt-in gate, the
 * Going skip and the copy.
 */

import * as fc from 'fast-check'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  send: vi.fn(),
  getCheckInsByUser: vi.fn(),
  getNodeById: vi.fn(),
  isGoing: vi.fn(),
  loadTonightByBusiness: vi.fn(),
  getPreferences: vi.fn(),
  sendNotification: vi.fn(async () => undefined),
  kvGet: vi.fn(async () => null),
  kvSet: vi.fn(async () => undefined),
}))

vi.mock('../../shared/db/dynamodb.js', () => ({
  documentClient: { send: h.send },
  TableNames: { users: 'test-users' },
}))
vi.mock('../../features/check-in/dynamodb-repository.js', () => ({ getCheckInsByUser: h.getCheckInsByUser }))
vi.mock('../../features/nodes/dynamodb-repository.js', () => ({ getNodeById: h.getNodeById }))
vi.mock('../../features/nodes/going-repository.js', () => ({ isGoing: h.isGoing }))
vi.mock('../../features/nodes/tonight-reader.js', () => ({ loadTonightByBusiness: h.loadTonightByBusiness }))
vi.mock('../../features/notifications/service.js', () => ({
  getPreferences: h.getPreferences,
  sendNotification: h.sendNotification,
}))
vi.mock('../../shared/kv/dynamodb-kv.js', () => ({ kvGet: h.kvGet, kvSet: h.kvSet }))

import { handler, pickTonightVenue, recentDistinctNodeIds } from '../tonight-known-venue-reminder.js'

const DAY_MS = 24 * 60 * 60 * 1000

// ─── Property 2 ──────────────────────────────────────────────────────────────

const idsArb = fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), { maxLength: 8 })

describe('Feature: North star alignment, Property 2: pickTonightVenue', () => {
  it('picks the earliest visited venue with a Tonight that the guest is not going to, else null', () => {
    fc.assert(
      fc.property(
        idsArb,
        fc.subarray(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
        fc.subarray(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
        (visited, withTonight, going) => {
          const tonight = new Map(withTonight.map((id) => [id, { headline: id }]))
          const pick = pickTonightVenue(visited, tonight, new Set(going))
          const eligible = visited.filter((id) => tonight.has(id) && !going.includes(id))

          if (eligible.length === 0) {
            expect(pick).toBeNull()
          } else {
            expect(pick).toBe(eligible[0])
            expect(going).not.toContain(pick)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('keeps distinct venues in visit order, capped', () => {
    expect(recentDistinctNodeIds(['a', 'b', 'a', 'c', 'b', 'd'], 3)).toEqual(['a', 'b', 'c'])
  })
})

// ─── Handler ─────────────────────────────────────────────────────────────────

const NODE = (id: string, businessId: string) => ({ nodeId: id, name: `Venue ${id}`, slug: `venue-${id}`, businessId })

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset()
  h.kvGet.mockResolvedValue(null)
  h.kvSet.mockResolvedValue(undefined)
  h.sendNotification.mockResolvedValue(undefined)
  h.send.mockResolvedValue({ Items: [{ userId: 'user-1' }] })
  h.getPreferences.mockResolvedValue({ tonightAtKnownVenue: true })
  h.isGoing.mockResolvedValue(false)
})

describe('tonight-known-venue-reminder handler (R3.2, R3.3)', () => {
  it('reads 200 check-ins over 90 days, considers 10 venues, and names the first with a Tonight', async () => {
    const venues = Array.from({ length: 12 }, (_, i) => `n${i}`)
    h.getCheckInsByUser.mockResolvedValue({ checkIns: venues.map((nodeId) => ({ nodeId })) })
    h.getNodeById.mockImplementation(async (id: string) => NODE(id, `biz-${id}`))
    h.loadTonightByBusiness.mockResolvedValue(
      new Map([
        ['biz-n3', { headline: 'Amapiano from 9' }],
        ['biz-n11', { headline: 'Never reached' }],
      ]),
    )

    const before = Date.now()
    const result = await handler()

    const [userId, opts] = h.getCheckInsByUser.mock.calls[0] as [
      string,
      { startTime: string; endTime: string; limit: number },
    ]
    expect(userId).toBe('user-1')
    expect(opts.limit).toBe(200)
    const span = Date.parse(opts.endTime) - Date.parse(opts.startTime)
    expect(span).toBe(90 * DAY_MS)
    expect(Date.parse(opts.endTime)).toBeGreaterThanOrEqual(before - 1000)
    expect(h.getNodeById).toHaveBeenCalledTimes(10)

    expect(h.sendNotification).toHaveBeenCalledTimes(1)
    expect(h.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'tonight_at_known_venue',
        title: 'Venue n3',
        body: 'Expected tonight: Amapiano from 9',
      }),
    )
    expect(result).toEqual({ scanned: 1, reminded: 1 })
  })

  it('skips a venue the guest marked going for and names the next one', async () => {
    h.getCheckInsByUser.mockResolvedValue({ checkIns: [{ nodeId: 'n1' }, { nodeId: 'n2' }] })
    h.getNodeById.mockImplementation(async (id: string) => NODE(id, `biz-${id}`))
    h.loadTonightByBusiness.mockResolvedValue(
      new Map([
        ['biz-n1', { headline: 'One' }],
        ['biz-n2', { headline: 'Two' }],
      ]),
    )
    h.isGoing.mockImplementation(async (key: { nodeId: string }) => key.nodeId === 'n1')

    await handler()

    expect(h.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Venue n2' }))
  })

  it('sends nothing to a guest who has not opted in, and reads nothing for them', async () => {
    h.getPreferences.mockResolvedValue({ tonightAtKnownVenue: false })

    await handler()

    expect(h.getCheckInsByUser).not.toHaveBeenCalled()
    expect(h.sendNotification).not.toHaveBeenCalled()
  })

  it('sends nothing when no visited venue has a Tonight', async () => {
    h.getCheckInsByUser.mockResolvedValue({ checkIns: [{ nodeId: 'n1' }] })
    h.getNodeById.mockImplementation(async (id: string) => NODE(id, `biz-${id}`))
    h.loadTonightByBusiness.mockResolvedValue(new Map())

    await handler()

    expect(h.sendNotification).not.toHaveBeenCalled()
  })

  it('never mentions a streak, a count or a reward', async () => {
    h.getCheckInsByUser.mockResolvedValue({ checkIns: [{ nodeId: 'n1' }] })
    h.getNodeById.mockImplementation(async (id: string) => NODE(id, `biz-${id}`))
    h.loadTonightByBusiness.mockResolvedValue(new Map([['biz-n1', { headline: 'Live jazz' }]]))

    await handler()

    const [message] = h.sendNotification.mock.calls[0] as unknown as [{ title: string; body: string }]
    expect(`${message.title} ${message.body}`).not.toMatch(/streak|reward|check-ins?|\d+-day/i)
  })

  it('excludes email and sub lock rows from the scan', async () => {
    await handler()

    const scan = h.send.mock.calls[0]![0] as { input: { FilterExpression: string } }
    expect(scan.input.FilterExpression).toBe('attribute_not_exists(lockType)')
  })
})
