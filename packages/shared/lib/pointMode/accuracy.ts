/**
 * Point_Mode honesty gate: beams are placed only when GPS and compass are good
 * enough to point at the right door (R8.6). Otherwise the screen says so.
 */
import { POINT_MODE_MAX_GPS_ACCURACY_METRES, POINT_MODE_MAX_HEADING_ACCURACY_DEG } from './constants'

export interface SignalReading {
  /** Geolocation `coords.accuracy`, metres. Null when no fix yet. */
  gpsAccuracyMetres: number | null
  /** Compass accuracy, degrees. Null when the device does not report a usable heading. */
  headingAccuracyDeg: number | null
}

export type SignalCheck = { ok: true } | { ok: false; reason: 'gps' | 'heading' }

export function checkSignal(reading: SignalReading): SignalCheck {
  const { gpsAccuracyMetres, headingAccuracyDeg } = reading
  if (gpsAccuracyMetres === null || gpsAccuracyMetres > POINT_MODE_MAX_GPS_ACCURACY_METRES) {
    return { ok: false, reason: 'gps' }
  }
  if (headingAccuracyDeg === null || headingAccuracyDeg > POINT_MODE_MAX_HEADING_ACCURACY_DEG) {
    return { ok: false, reason: 'heading' }
  }
  return { ok: true }
}
