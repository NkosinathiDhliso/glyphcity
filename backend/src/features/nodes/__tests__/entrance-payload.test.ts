/**
 * Entrance_Pin reaches the city payload and nothing else (GlyphCity rebrand
 * R9.3, R9.4, task 11.4).
 *
 *  - the payload carries `entrance` only for venues that set one
 *  - the venue's own `lat`/`lng` are untouched by an entrance, so the map
 *    marker, check-in radius and proximity math keep using the venue pin
 *  - ranking, membership and check-in code never read the entrance
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({ sendMock: vi.fn(), findBusinessById: vi.fn() }))

vi.mock('../../../shared/db/dynamodb.js', () => ({
  documentClient: { send: mocks.sendMock },
  TableNames: { nodes: 'nodes', appData: 'app-data' },
}))
vi.mock('../../business/repository.js', () => ({ findBusinessById: mocks.findBusinessById }))
vi.mock('../../rewards/dynamodb-repository.js', () => ({ getActiveRewardsByNodeId: vi.fn().mockResolvedValue([]) }))
vi.mock('../../check-in/dynamodb-repository.js', () => ({
  getCheckInsByNode: vi.fn().mockResolvedValue({ checkIns: [] }),
}))
vi.mock('../../auth/dynamodb-repository.js', () => ({ getUserById: vi.fn().mockResolvedValue(null) }))
vi.mock('../../../shared/db/entities.js', () => ({ generateId: vi.fn(() => 'mock-id') }))
vi.mock('../dynamodb-repository.js', () => ({
  getNodeById: vi.fn(),
  getNodeBySlug: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
}))

import { getNodesByCitySlug } from '../repository.js'

const CITY_SLUG = 'johannesburg'
const CITY_ID = 'city-jhb'
const DOOR = { lat: -26.20482, lng: 28.05958 }

function venue(nodeId: string, extra: Record<string, unknown> = {}) {
  return {
    nodeId,
    name: nodeId,
    slug: nodeId,
    category: 'nightlife',
    lat: -26.20467,
    lng: 28.05941,
    cityId: CITY_ID,
    isActive: true,
    businessId: 'biz-paid',
    claimStatus: 'claimed',
    ...extra,
  }
}

beforeEach(() => {
  mocks.sendMock.mockReset()
  mocks.findBusinessById.mockReset()
  mocks.findBusinessById.mockResolvedValue({ id: 'biz-paid', tier: 'growth' })
  mocks.sendMock.mockImplementation(async (cmd: unknown) => {
    const input = (cmd as { input?: Record<string, unknown> })?.input ?? {}
    if ('Key' in input) return { Item: { id: CITY_ID, name: 'Johannesburg', slug: CITY_SLUG } }
    if ('KeyConditionExpression' in input || 'FilterExpression' in input) {
      return { Items: [venue('with-door', { entrance: DOOR }), venue('no-door')] }
    }
    return {}
  })
})

describe('city payload Entrance_Pin', () => {
  it('carries entrance only when set, and keeps the venue pin as lat/lng', async () => {
    const nodes = (await getNodesByCitySlug(CITY_SLUG)) as Array<Record<string, unknown>>
    const withDoor = nodes.find((n) => n['id'] === 'with-door')!
    const noDoor = nodes.find((n) => n['id'] === 'no-door')!

    expect(withDoor['entrance']).toEqual(DOOR)
    expect(noDoor).not.toHaveProperty('entrance')
    expect(withDoor['lat']).toBe(-26.20467)
    expect(withDoor['lng']).toBe(28.05941)
  })

  it('does not change map membership', async () => {
    const nodes = await getNodesByCitySlug(CITY_SLUG)
    expect(nodes).toHaveLength(2)
  })
})

describe('ranking, membership and check-in never read the entrance (R9.4)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it.each([
    ['vibeRank', '../../../../../apps/web/src/lib/carouselRanking.ts'],
    ['check-in service', '../../check-in/service.ts'],
    ['check-in repository', '../../check-in/repository.ts'],
  ])('%s has no entrance reference', (_name, rel) => {
    expect(read(rel)).not.toMatch(/entrance/i)
  })
})
