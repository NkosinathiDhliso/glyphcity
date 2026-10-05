/**
 * Point_Mode geometry: where a venue sits on the camera view, from the
 * device's position and compass heading. Pure functions; no sensors here.
 */
import { haversineDistance, initialBearing } from '../geoUtils'

import { POINT_MODE_HORIZON_RATIO } from './constants'

export interface LatLng {
  lat: number
  lng: number
}

/** Bearing from `from` to `to`, degrees [0, 360), 0 = north. */
export function bearingTo(from: LatLng, to: LatLng): number {
  return initialBearing(from.lat, from.lng, to.lat, to.lng)
}

/** Distance from `from` to `to`, metres. */
export function distanceTo(from: LatLng, to: LatLng): number {
  return haversineDistance(from.lat, from.lng, to.lat, to.lng) * 1000
}

/** Angle from where the camera points to the venue, normalised to (-180, 180]. Negative is left. */
export function relativeAngle(bearing: number, heading: number): number {
  const a = (((bearing - heading) % 360) + 360) % 360
  return a > 180 ? a - 360 : a
}

/** Screen x for a relative angle, or null when the venue is outside the field of view. */
export function project(rel: number, fovDeg: number, width: number): number | null {
  const half = fovDeg / 2
  if (Math.abs(rel) > half) return null
  return width / 2 + (rel / half) * (width / 2)
}

/** Beam scale by distance: near venues large, far venues small, never below 0.35. */
export function depthScale(distanceMetres: number): number {
  const raw = 0.3 + 0.9 / (1 + distanceMetres / 60)
  return Math.min(1, Math.max(0.35, raw))
}

/** Screen y of the venue's door: the bottom edge up close, rising toward the horizon with distance. */
export function groundY(distanceMetres: number, height: number): number {
  const horizon = height * POINT_MODE_HORIZON_RATIO
  return horizon + (height - horizon) / (1 + distanceMetres / 40)
}
