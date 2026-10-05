/**
 * Point_Mode view: which venues sit in the camera frame and where. Input is
 * already in `vibeRank` order and already filtered to map membership, so
 * order and visibility follow the map; distance only scales size (R8.2, R8.3).
 * Pure; the screen feeds it sensor readings.
 */
import { clusterByAngle, type InViewVenue } from './cluster'
import { POINT_MODE_FOV_DEG, POINT_MODE_RADIUS_METRES } from './constants'
import { bearingTo, depthScale, distanceTo, groundY, project, relativeAngle, type LatLng } from './geometry'

export interface PointModeVenue extends LatLng {
  id: string
  entrance?: LatLng | null
}

export interface PlacedVenue<T> {
  venue: T
  distanceMetres: number
  scale: number
  /** Screen y of the venue's door, where the cone tip sits. */
  y: number
}

export interface PlacedStack<T> {
  /** Screen x of the stack. */
  x: number
  /** Screen y of the nearest door in the stack. */
  y: number
  /** Venues in vibeRank order. */
  venues: PlacedVenue<T>[]
}

export interface PointModeView<T> {
  /** Venues within the radius, in any direction. Zero means nothing nearby at all. */
  inRadius: number
  /** Stacks in frame, left to right. */
  stacks: PlacedStack<T>[]
}

export interface PlaceVenuesInput<T> {
  ranked: T[]
  position: LatLng
  headingDeg: number
  headingAccuracyDeg: number
  width: number
  height: number
  /** Most beams to render (`RECOMMENDED_LIMIT`). */
  limit: number
  radiusMetres?: number
  fovDeg?: number
}

/** Where a beam stands: the Entrance_Pin when the owner set one, else the venue pin (R9.3). */
export function pointTarget(venue: PointModeVenue): LatLng {
  return venue.entrance ?? { lat: venue.lat, lng: venue.lng }
}

export function placeVenues<T extends PointModeVenue>(input: PlaceVenuesInput<T>): PointModeView<T> {
  const { ranked, position, headingDeg, headingAccuracyDeg, width, height, limit } = input
  const radius = input.radiusMetres ?? POINT_MODE_RADIUS_METRES
  const fov = input.fovDeg ?? POINT_MODE_FOV_DEG

  const nearby = ranked
    .map((venue, rank) => ({ venue, rank, target: pointTarget(venue) }))
    .map((v) => ({ ...v, distanceMetres: distanceTo(position, v.target) }))
    .filter((v) => v.distanceMetres <= radius)

  const inView: InViewVenue<PlacedVenue<T>>[] = []
  for (const v of nearby.slice(0, limit)) {
    const rel = relativeAngle(bearingTo(position, v.target), headingDeg)
    if (project(rel, fov, width) === null) continue
    inView.push({
      rel,
      rank: v.rank,
      venue: {
        venue: v.venue,
        distanceMetres: v.distanceMetres,
        scale: depthScale(v.distanceMetres),
        y: groundY(v.distanceMetres, height),
      },
    })
  }

  const stacks = clusterByAngle(inView, headingAccuracyDeg).map((stack) => ({
    x: project(stack.rel, fov, width) ?? width / 2,
    y: Math.max(...stack.venues.map((v) => v.y)),
    venues: stack.venues,
  }))
  return { inRadius: nearby.length, stacks }
}
