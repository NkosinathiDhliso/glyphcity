/**
 * Point_Mode compass heading: which way the rear camera points, from the
 * device orientation, and a short circular average to steady it. Pure.
 */

/** Compass accuracy assumed for an Android absolute orientation event, which reports none. */
export const ANDROID_ABSOLUTE_HEADING_ACCURACY_DEG = 20

/** Heading samples older than this drop out of the average. */
export const HEADING_SMOOTHING_MS = 300

const RAD = Math.PI / 180

/**
 * Compass heading of the rear camera, degrees [0, 360), from W3C
 * DeviceOrientation Euler angles (alpha, beta, gamma, in degrees). Works with
 * the phone held upright, where `360 - alpha` alone would not.
 */
export function compassHeadingFromEuler(alpha: number, beta: number, gamma: number): number {
  const x = beta * RAD
  const y = gamma * RAD
  const z = alpha * RAD
  const vx = -Math.cos(z) * Math.sin(y) - Math.sin(z) * Math.sin(x) * Math.cos(y)
  const vy = -Math.sin(z) * Math.sin(y) + Math.cos(z) * Math.sin(x) * Math.cos(y)
  const heading = Math.atan2(vx, vy) / RAD
  return ((heading % 360) + 360) % 360
}

/** Circular mean of headings in degrees, so 359 and 1 average to 0, not 180. Null for none. */
export function circularMean(degrees: number[]): number | null {
  if (degrees.length === 0) return null
  let sin = 0
  let cos = 0
  for (const d of degrees) {
    sin += Math.sin(d * RAD)
    cos += Math.cos(d * RAD)
  }
  const mean = Math.atan2(sin, cos) / RAD
  return ((mean % 360) + 360) % 360
}

export interface HeadingSample {
  deg: number
  at: number
}

/** Add a sample and drop the ones older than the smoothing window. */
export function pushHeadingSample(samples: HeadingSample[], sample: HeadingSample): HeadingSample[] {
  return [...samples.filter((s) => sample.at - s.at <= HEADING_SMOOTHING_MS), sample]
}
