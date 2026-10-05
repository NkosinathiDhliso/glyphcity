import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type mapboxgl from 'mapbox-gl'
import { describe, expect, it, vi } from 'vitest'

import { MIN_MARKER_ZOOM } from '../carouselConstants'
import {
  CONTOUR_LAYER_ID,
  CONTOUR_SOURCE_ID,
  OUTDOOR_MAP_PAINT,
  PARK_CLASSES,
  addContours,
  applyOutdoorPaint,
  contoursEnabled,
} from '../mapTerrain'

const STOCK_LANDUSE = '#123456'

function fakeMap(opts: { hasContourLayer?: boolean } = {}) {
  const layers = [
    { id: 'land', type: 'background' },
    { id: 'water', type: 'fill', 'source-layer': 'water' },
    { id: 'waterway', type: 'line', 'source-layer': 'waterway' },
    { id: 'landuse', type: 'fill', 'source-layer': 'landuse' },
    { id: 'road-primary', type: 'line', 'source-layer': 'road' },
    { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
  ]
  const map = {
    getStyle: vi.fn(() => ({ layers })),
    setPaintProperty: vi.fn(),
    getPaintProperty: vi.fn(() => STOCK_LANDUSE),
    getSource: vi.fn(() => null),
    addSource: vi.fn(),
    getLayer: vi.fn(() => (opts.hasContourLayer ? { id: CONTOUR_LAYER_ID } : undefined)),
    addLayer: vi.fn(),
  }
  return { map, asMap: map as unknown as mapboxgl.Map }
}

describe('applyOutdoorPaint', () => {
  it.each(['light', 'dark'] as const)('paints ground, water and parks for %s', (theme) => {
    const { map, asMap } = fakeMap()
    const paint = OUTDOOR_MAP_PAINT[theme]
    applyOutdoorPaint(asMap, theme)

    expect(map.setPaintProperty).toHaveBeenCalledWith('land', 'background-color', paint.ground)
    expect(map.setPaintProperty).toHaveBeenCalledWith('water', 'fill-color', paint.water)
    expect(map.setPaintProperty).toHaveBeenCalledWith('waterway', 'line-color', paint.water)
    expect(map.setPaintProperty).toHaveBeenCalledWith('landuse', 'fill-color', [
      'match',
      ['get', 'class'],
      PARK_CLASSES,
      paint.park,
      STOCK_LANDUSE,
    ])
  })

  it('leaves roads and labels alone', () => {
    const { map, asMap } = fakeMap()
    applyOutdoorPaint(asMap, 'dark')
    const touched = map.setPaintProperty.mock.calls.map((c) => c[0])
    expect(touched).not.toContain('road-primary')
    expect(touched).not.toContain('poi-label')
  })
})

describe('addContours', () => {
  it('adds the terrain source and a contour layer below the roads, hidden below Embers zoom', () => {
    const { map, asMap } = fakeMap()
    addContours(asMap, 'light')

    expect(map.addSource).toHaveBeenCalledWith(CONTOUR_SOURCE_ID, {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-terrain-v2',
    })
    expect(map.addLayer).toHaveBeenCalledTimes(1)
    const [layer, beforeId] = map.addLayer.mock.calls[0] as [Record<string, unknown>, string]
    expect(beforeId).toBe('road-primary')
    expect(layer).toMatchObject({
      id: CONTOUR_LAYER_ID,
      type: 'line',
      source: CONTOUR_SOURCE_ID,
      'source-layer': 'contour',
      minzoom: MIN_MARKER_ZOOM,
    })
    expect((layer['paint'] as Record<string, unknown>)['line-color']).toBe(OUTDOOR_MAP_PAINT.light.contour)
  })

  it('only recolours on a repeat call', () => {
    const { map, asMap } = fakeMap({ hasContourLayer: true })
    addContours(asMap, 'dark')
    expect(map.addLayer).not.toHaveBeenCalled()
    expect(map.setPaintProperty).toHaveBeenCalledWith(CONTOUR_LAYER_ID, 'line-color', OUTDOOR_MAP_PAINT.dark.contour)
  })
})

describe('contoursEnabled', () => {
  it('needs a high-tier device on unmetered data', () => {
    expect(contoursEnabled('high', false)).toBe(true)
    expect(contoursEnabled('high', true)).toBe(false)
    expect(contoursEnabled('low', false)).toBe(false)
    expect(contoursEnabled('low', true)).toBe(false)
  })
})

describe('venue markers stay out of the WebGL scene (R6.4)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('venues render as DOM markers, so fog and scene lights cannot reach them', () => {
    const markers = read('../../hooks/useMapMarkers.ts')
    expect(markers).toMatch(/new\s+\w+\.Marker\(\{[\s\S]{0,200}element:/)
    expect(markers).not.toMatch(/type:\s*'symbol'/)
  })

  it('the terrain module never touches marker DOM', () => {
    const terrain = read('../mapTerrain.ts')
    expect(terrain).not.toMatch(/node-marker|\.Marker\(|document\./)
  })
})
