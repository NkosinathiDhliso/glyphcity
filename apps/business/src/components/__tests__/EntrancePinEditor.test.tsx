// @vitest-environment jsdom
/**
 * Entrance_Pin editor (GlyphCity rebrand R9.1, task 11.3). Mapbox is mocked:
 * the test drives the draggable door marker directly.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: { dragTo: { lat: number; lng: number }; dragend: (() => void) | null } = {
    dragTo: { lat: 0, lng: 0 },
    dragend: null,
  }
  class FakeMap {
    on() {
      return this
    }
    addSource() {}
    addLayer() {}
    remove() {}
  }
  class FakeMarker {
    draggable: boolean
    constructor(opts: { draggable?: boolean }) {
      this.draggable = Boolean(opts.draggable)
    }
    setLngLat() {
      return this
    }
    addTo() {
      return this
    }
    on(_event: string, handler: () => void) {
      if (this.draggable) state.dragend = handler
      return this
    }
    getLngLat() {
      return state.dragTo
    }
  }
  return { state, put: vi.fn(), FakeMap, FakeMarker }
})

vi.mock('mapbox-gl', () => ({ default: { Map: mocks.FakeMap, Marker: mocks.FakeMarker, accessToken: '' } }))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))
vi.mock('@area-code/shared/lib/api', () => ({ api: { put: mocks.put } }))

vi.stubEnv('VITE_MAPBOX_TOKEN', 'test-token')

const { EntrancePinEditor } = await import('../EntrancePinEditor')

// Fox St, Maboneng.
const VENUE = { lat: -26.20467, lng: 28.05941 }
const NEAR_DOOR = { lat: -26.20482, lng: 28.05958 }
const NEXT_BLOCK = { lat: -26.20467, lng: 28.06041 }

async function dragDoorTo(point: { lat: number; lng: number }) {
  await waitFor(() => expect(mocks.state.dragend).not.toBeNull())
  mocks.state.dragTo = point
  act(() => mocks.state.dragend!())
}

beforeEach(() => {
  mocks.put.mockReset().mockResolvedValue({})
  mocks.state.dragend = null
})
afterEach(cleanup)

describe('EntrancePinEditor', () => {
  it('saves a door inside the 75 m circle', async () => {
    const onSaved = vi.fn()
    render(<EntrancePinEditor nodeId="n1" venue={VENUE} entrance={null} onSaved={onSaved} />)
    await dragDoorTo(NEAR_DOOR)

    expect(screen.getByText(/m from your venue pin/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save entrance' }))

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/v1/nodes/n1', { entrance: NEAR_DOOR }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(screen.getByRole('status').textContent).toBe('Entrance saved.')
  })

  it('blocks saving a door on the next block', async () => {
    render(<EntrancePinEditor nodeId="n1" venue={VENUE} entrance={null} onSaved={vi.fn()} />)
    await dragDoorTo(NEXT_BLOCK)

    expect(screen.getByText(/Keep the pin within 75 m of your venue/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save entrance' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('removes a saved door', async () => {
    render(<EntrancePinEditor nodeId="n1" venue={VENUE} entrance={NEAR_DOOR} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/v1/nodes/n1', { entrance: null }))
  })

  it('offers Remove only when a door is saved', () => {
    render(<EntrancePinEditor nodeId="n1" venue={VENUE} entrance={null} onSaved={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })
})
