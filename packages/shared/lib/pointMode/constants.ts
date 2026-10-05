// Point_Mode thresholds. Values recorded in docs/decisions/glyphcity-rebrand.md section 7.

/** Venues further than this from the device are not shown. */
export const POINT_MODE_RADIUS_METRES = 250

/** Worse GPS accuracy than this means beams cannot be placed honestly. */
export const POINT_MODE_MAX_GPS_ACCURACY_METRES = 35

/** Worse compass accuracy than this means beams cannot be placed honestly. */
export const POINT_MODE_MAX_HEADING_ACCURACY_DEG = 25

/** Typical phone main camera, horizontal field of view in portrait. */
export const POINT_MODE_FOV_DEG = 60

/** Venues closer in bearing than max(heading accuracy, this) share one stacked label. */
export const POINT_MODE_MIN_CLUSTER_GAP_DEG = 6

/** Where the horizon sits on screen, as a share of the view height from the top. */
export const POINT_MODE_HORIZON_RATIO = 0.42
