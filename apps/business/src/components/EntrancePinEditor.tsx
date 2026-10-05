import { api } from '@area-code/shared/lib/api'
import { describeApiError } from '@area-code/shared/lib/apiError'
import { ENTRANCE_MAX_DISTANCE_METRES, entranceWithinBound, type LatLngPoint } from '@area-code/shared/lib/entrance'
import { haversineDistance } from '@area-code/shared/lib/geoUtils'
import type mapboxgl from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'

/**
 * Entrance_Pin editor (GlyphCity rebrand R9.1). The owner drags a pin onto the
 * front door, inside a 75 m circle around the venue pin. Point_Mode puts the
 * venue's beam there; nothing else uses it.
 */
interface EntrancePinEditorProps {
  nodeId: string
  venue: LatLngPoint
  entrance: LatLngPoint | null | undefined
  onSaved: () => void
}

const MAPBOX_TOKEN = import.meta.env['VITE_MAPBOX_TOKEN'] as string | undefined
const CIRCLE_SOURCE_ID = 'entrance-bound'

/** 64-point polygon approximating a circle of `metres` around `centre`. */
function circlePolygon(centre: LatLngPoint, metres: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const latScale = 111_320
  const lngScale = 111_320 * Math.cos((centre.lat * Math.PI) / 180)
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI
    return [centre.lng + (metres * Math.cos(a)) / lngScale, centre.lat + (metres * Math.sin(a)) / latScale]
  })
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function pinElement(variant: 'venue' | 'door'): HTMLDivElement {
  const el = document.createElement('div')
  const size = variant === 'door' ? 28 : 12
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: variant === 'door' ? 'var(--text-primary)' : 'var(--text-muted)',
    border: '3px solid var(--bg-base)',
    cursor: variant === 'door' ? 'grab' : 'default',
  })
  return el
}

export function EntrancePinEditor({ nodeId, venue, entrance, onSaved }: EntrancePinEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [door, setDoor] = useState<LatLngPoint>(entrance ?? venue)
  const [mapError, setMapError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Effects key on the coordinates, not the objects, so a parent re-render
  // never rebuilds the map.
  const venueLat = venue.lat
  const venueLng = venue.lng
  const doorLat = entrance?.lat
  const doorLng = entrance?.lng

  useEffect(() => {
    setDoor(
      doorLat !== undefined && doorLng !== undefined
        ? { lat: doorLat, lng: doorLng }
        : { lat: venueLat, lng: venueLng },
    )
  }, [venueLat, venueLng, doorLat, doorLng])

  useEffect(() => {
    const centre = { lat: venueLat, lng: venueLng }
    const start = doorLat !== undefined && doorLng !== undefined ? { lat: doorLat, lng: doorLng } : centre
    const container = containerRef.current
    if (!container) return
    if (!MAPBOX_TOKEN) {
      setMapError('The map is not configured, so the entrance pin cannot be placed here yet.')
      return
    }
    let map: mapboxgl.Map | null = null
    let cancelled = false
    Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')])
      .then(([mod]) => {
        if (cancelled) return
        const gl = mod.default
        gl.accessToken = MAPBOX_TOKEN
        map = new gl.Map({
          container,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [centre.lng, centre.lat],
          zoom: 18,
        })
        const created = map
        created.on('load', () => {
          created.addSource(CIRCLE_SOURCE_ID, {
            type: 'geojson',
            data: circlePolygon(centre, ENTRANCE_MAX_DISTANCE_METRES),
          })
          created.addLayer({
            id: `${CIRCLE_SOURCE_ID}-fill`,
            type: 'fill',
            source: CIRCLE_SOURCE_ID,
            paint: { 'fill-color': cssVar('--text-primary'), 'fill-opacity': 0.06 },
          })
          created.addLayer({
            id: `${CIRCLE_SOURCE_ID}-line`,
            type: 'line',
            source: CIRCLE_SOURCE_ID,
            paint: { 'line-color': cssVar('--text-primary'), 'line-width': 1.5, 'line-dasharray': [2, 2] },
          })
        })
        new gl.Marker({ element: pinElement('venue') }).setLngLat([centre.lng, centre.lat]).addTo(created)
        const doorMarker = new gl.Marker({ element: pinElement('door'), draggable: true })
          .setLngLat([start.lng, start.lat])
          .addTo(created)
        doorMarker.on('dragend', () => {
          const { lat, lng } = doorMarker.getLngLat()
          setDoor({ lat, lng })
          setMessage(null)
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('[EntrancePinEditor] map failed to load', err)
        setMapError('The map could not load. Check your connection and try again.')
      })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [venueLat, venueLng, doorLat, doorLng])

  const withinBound = entranceWithinBound(venue, door)
  const metres = Math.round(haversineDistance(venue.lat, venue.lng, door.lat, door.lng) * 1000)

  async function save(next: LatLngPoint | null) {
    setSaving(true)
    setMessage(null)
    try {
      await api.put(`/v1/nodes/${nodeId}`, { entrance: next })
      setMessage({ kind: 'ok', text: next ? 'Entrance saved.' : 'Entrance removed.' })
      onSaved()
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: describeApiError(err, 'Could not save the entrance. Please try again.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[var(--text-secondary)] text-xs font-medium">Front door</label>
      <span className="text-[var(--text-secondary)] text-xs">
        Drag the pin onto your entrance, inside the circle. People pointing their camera at the street see your beam
        there.
      </span>
      {mapError ? (
        <p role="alert" className="text-[var(--danger)] text-sm">
          {mapError}
        </p>
      ) : (
        <div
          ref={containerRef}
          className="w-full h-56 rounded-2xl overflow-hidden border border-[var(--border)]"
          aria-label="Map for placing your entrance pin"
        />
      )}
      <span className={`text-xs ${withinBound ? 'text-[var(--text-secondary)]' : 'text-[var(--danger)]'}`}>
        {withinBound
          ? `${metres} m from your venue pin`
          : `${metres} m away. Keep the pin within ${ENTRANCE_MAX_DISTANCE_METRES} m of your venue.`}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save(door)}
          disabled={saving || !withinBound || Boolean(mapError)}
          className="min-h-11 flex-1 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold active:scale-95 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save entrance'}
        </button>
        {entrance && (
          <button
            type="button"
            onClick={() => void save(null)}
            disabled={saving}
            className="min-h-11 px-4 rounded-xl border border-[var(--border)] text-[var(--text-primary)] text-sm active:scale-95 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`text-sm ${message.kind === 'error' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
