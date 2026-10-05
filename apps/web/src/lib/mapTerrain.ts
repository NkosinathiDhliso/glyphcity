/**
 * Outdoor map paint and contour terrain (GlyphCity rebrand R6).
 *
 * The basemap keeps the Mapbox dark/light styles; this module re-tints the
 * ground, water and parks to the Outdoor_Palette and adds faint contour lines
 * so beams rise out of real terrain. Venue markers are DOM markers above the
 * canvas, so nothing here can tint a Cone_Node.
 */
import type mapboxgl from 'mapbox-gl'

import { MIN_MARKER_ZOOM } from './carouselConstants'
import type { DeviceTier } from './deviceTier'

export type MapTheme = 'light' | 'dark'

interface OutdoorPaint {
  ground: string
  water: string
  park: string
  contour: string
}

/**
 * Map ground colours. They mirror the Outdoor_Palette rows Ground, Water
 * (Spruit), Parks (Koppie) and Contour in `packages/shared/tokens.css`; Mapbox
 * paint properties cannot read CSS variables, so the map keeps its own copy,
 * the same way `ATMOSPHERE` in `useMapInit.ts` does.
 */
export const OUTDOOR_MAP_PAINT: Record<MapTheme, OutdoorPaint> = {
  light: { ground: '#e5eadd', water: '#c8dcdb', park: '#d2dec6', contour: 'rgba(19, 33, 27, 0.16)' },
  dark: { ground: '#090e0c', water: '#0b1a1f', park: '#0e1912', contour: 'rgba(231, 237, 230, 0.1)' },
}

/** Landuse classes painted as parkland. */
export const PARK_CLASSES = ['park', 'grass', 'pitch', 'wood', 'scrub', 'garden', 'golf_course', 'national_park']

export const CONTOUR_SOURCE_ID = 'outdoor-contours'
export const CONTOUR_LAYER_ID = 'outdoor-contour-lines'

/** Mapbox terrain vector tiles mark every fifth contour as an index line (index 5 or 10). */
const INDEX_CONTOURS = [5, 10]

type StyleLayer = mapboxgl.AnyLayer & { 'source-layer'?: string }

function styleLayers(map: mapboxgl.Map): StyleLayer[] {
  return (map.getStyle()?.layers ?? []) as StyleLayer[]
}

/**
 * Re-tint ground, water and parks for the theme. Call on every `style.load`:
 * each style swap starts from the stock Mapbox paint, so the park expression
 * wraps that stock colour exactly once.
 */
export function applyOutdoorPaint(map: mapboxgl.Map, theme: MapTheme): void {
  const paint = OUTDOOR_MAP_PAINT[theme]
  const setPaint = map.setPaintProperty.bind(map) as (id: string, prop: string, value: unknown) => void
  for (const layer of styleLayers(map)) {
    const sourceLayer = layer['source-layer']
    try {
      if (layer.type === 'background') {
        setPaint(layer.id, 'background-color', paint.ground)
      } else if (layer.type === 'fill' && sourceLayer === 'water') {
        setPaint(layer.id, 'fill-color', paint.water)
      } else if (layer.type === 'line' && sourceLayer === 'waterway') {
        setPaint(layer.id, 'line-color', paint.water)
      } else if (layer.type === 'fill' && (sourceLayer === 'landuse' || sourceLayer === 'landuse_overlay')) {
        const stock = map.getPaintProperty(layer.id, 'fill-color' as never) as unknown
        setPaint(layer.id, 'fill-color', ['match', ['get', 'class'], PARK_CLASSES, paint.park, stock ?? paint.ground])
      }
    } catch {
      /* ground paint is cosmetic - fail open, matching the other map layers */
    }
  }
}

/** Contours cost tile bandwidth and GPU, so only capable devices on unmetered data get them. */
export function contoursEnabled(tier: DeviceTier, reducedData: boolean): boolean {
  return tier === 'high' && !reducedData
}

/** True when the browser reports `prefers-reduced-data: reduce`. */
export function prefersReducedData(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-data: reduce)').matches
}

/**
 * Add faint contour lines from the Mapbox terrain tileset, below the road
 * network and labels, hidden below Embers zoom. Idempotent per style.
 */
export function addContours(map: mapboxgl.Map, theme: MapTheme): void {
  const paint = OUTDOOR_MAP_PAINT[theme]
  if (!map.getSource(CONTOUR_SOURCE_ID)) {
    map.addSource(CONTOUR_SOURCE_ID, { type: 'vector', url: 'mapbox://mapbox.mapbox-terrain-v2' })
  }
  if (map.getLayer(CONTOUR_LAYER_ID)) {
    map.setPaintProperty(CONTOUR_LAYER_ID, 'line-color', paint.contour)
    return
  }
  const firstRoad = styleLayers(map).find((l) => l['source-layer'] === 'road')
  map.addLayer(
    {
      id: CONTOUR_LAYER_ID,
      type: 'line',
      source: CONTOUR_SOURCE_ID,
      'source-layer': 'contour',
      minzoom: MIN_MARKER_ZOOM,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': paint.contour,
        'line-width': ['interpolate', ['linear'], ['zoom'], MIN_MARKER_ZOOM, 0.6, 16, 1],
        'line-opacity': ['match', ['get', 'index'], INDEX_CONTOURS, 1, 0.55],
      },
    } as mapboxgl.AnyLayer,
    firstRoad?.id,
  )
}
