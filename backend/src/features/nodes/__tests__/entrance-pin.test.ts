/**
 * Entrance_Pin on the node update path (GlyphCity rebrand R9.1, R9.2, task 11.1).
 *
 *  - an entrance within 75 m of the venue is stored
 *  - an entrance further away is refused with a specific message
 *  - `null` clears the pin
 *  - moving the venue pin without re-placing the entrance clears it, so a stale
 *    door can never point Point_Mode at the wrong building
 *  - moving the venue and placing the entrance together checks against the new spot
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateNode: vi.fn(),
  getNodeById: vi.fn(),
  invalidateCityPayloadForNode: vi.fn(),
}))

vi.mock('../../../shared/config/env.js', () => ({
  DEV_MODE: false,
  APP_ENV: 'test',
  AWS_REGION: 'af-south-1',
  requireEnv: (_name: string, devDefault?: string) => devDefault ?? 'test-value',
  mediaCdnBaseUrl: () => 'https://cdn.example.test',
  webBaseUrl: () => 'https://example.test',
}))

vi.mock('../../../shared/kv/dynamodb-kv.js', () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvBatchGet: vi.fn(),
  kvDel: vi.fn(),
}))

vi.mock('../../../shared/db/dynamodb.js', () => ({
  documentClient: { send: vi.fn() },
  TableNames: { appData: 'area-code-test-app-data' },
}))

vi.mock('../repository.js', () => ({ updateNode: mocks.updateNode }))
vi.mock('../dynamodb-repository.js', () => ({ getNodeById: mocks.getNodeById }))
vi.mock('../cache.js', () => ({
  cityPayloadCacheKey: vi.fn(),
  invalidateCityPayload: vi.fn(),
  invalidateCityPayloadForNode: mocks.invalidateCityPayloadForNode,
}))

import { updateNode } from '../service.js'

// Fox St, Maboneng.
const VENUE = { lat: -26.20467, lng: 28.05941 }
const NEAR_DOOR = { lat: -26.20482, lng: 28.05958 } // about 24 m away
const NEXT_BLOCK = { lat: -26.20467, lng: 28.06041 } // about 100 m away

function lastPatch(): Record<string, unknown> {
  return mocks.updateNode.mock.calls.at(-1)![2] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateNode.mockResolvedValue({ count: 1 })
  mocks.getNodeById.mockResolvedValue({ nodeId: 'n1', ...VENUE })
})

describe('updateNode entrance pin', () => {
  it('stores an entrance within 75 m', async () => {
    await updateNode('n1', 'b1', { entrance: NEAR_DOOR })
    expect(lastPatch()['entrance']).toEqual(NEAR_DOOR)
  })

  it('refuses an entrance on the next block', async () => {
    await expect(updateNode('n1', 'b1', { entrance: NEXT_BLOCK })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('within 75 m'),
    })
    expect(mocks.updateNode).not.toHaveBeenCalled()
  })

  it('clears the pin on null', async () => {
    await updateNode('n1', 'b1', { entrance: null })
    expect(lastPatch()['entrance']).toBeNull()
    expect(mocks.getNodeById).not.toHaveBeenCalled()
  })

  it('clears a stale pin when the venue moves without a new entrance', async () => {
    await updateNode('n1', 'b1', { address: '1 Fox Street, Maboneng', ...NEXT_BLOCK })
    expect(lastPatch()['entrance']).toBeNull()
  })

  it('checks a new entrance against the new venue position', async () => {
    const door = { lat: NEXT_BLOCK.lat - 0.0001, lng: NEXT_BLOCK.lng }
    await updateNode('n1', 'b1', { address: '1 Fox Street, Maboneng', ...NEXT_BLOCK, entrance: door })
    expect(lastPatch()['entrance']).toEqual(door)
    expect(mocks.getNodeById).not.toHaveBeenCalled()
  })

  it('leaves the entrance untouched on unrelated edits', async () => {
    await updateNode('n1', 'b1', { name: 'Fox Street Yard' })
    expect(lastPatch()).not.toHaveProperty('entrance')
  })
})
