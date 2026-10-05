/**
 * Entrance_Pin (GlyphCity rebrand R9): an owner-set front-door coordinate used
 * only by Point_Mode. It must sit close to the venue's own pin so a beam can
 * never be dragged onto a different building down the street.
 */
import { haversineDistance } from './geoUtils'

export const ENTRANCE_MAX_DISTANCE_METRES = 75

export interface LatLngPoint {
  lat: number
  lng: number
}

/** True when the entrance is within `ENTRANCE_MAX_DISTANCE_METRES` of the venue pin. */
export function entranceWithinBound(venue: LatLngPoint, entrance: LatLngPoint): boolean {
  return haversineDistance(venue.lat, venue.lng, entrance.lat, entrance.lng) * 1000 <= ENTRANCE_MAX_DISTANCE_METRES
}
