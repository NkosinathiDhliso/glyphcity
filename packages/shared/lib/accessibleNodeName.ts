import { getGlyphName } from '../constants/archetype-catalog'
import { categoryLabel, categoryLabelKey } from '../constants/node-categories'
import { PLAIN_SCALE_EN, presenceStateKey } from '../constants/state-labels'
import type { NodeCategory, NodeState } from '../types'

/** i18n translator shape: key plus English default. Matches i18next `t(key, default)`. */
export type Translate = (key: string, defaultValue: string) => string

/** Count suffix key, shared with the venue card ("12 here now"). */
const HERE_NOW_KEY = 'venueCard.hereNow'
const HERE_NOW_EN = 'here now'

/**
 * The state segment follows `presenceStateKey`, the honest-presence rule shared
 * with the share snapshot.
 *
 * Accessible name for a Cone_Node and its glyph (glyphcity-rebrand R3.6):
 * venue name, category word, Glyph_Name, state word or invite, then "N here
 * now" when people are present on a non-dormant pulse. Never reads the archetype `description`. An
 * unknown archetype omits the glyph segment.
 *
 * Example: "Fox Street Yard, Nightlife, The Township Royal, Very busy, 41 here now"
 */
export function accessibleNodeName(
  node: { name: string; category: NodeCategory },
  archetypeId: string | null | undefined,
  state: NodeState,
  liveCount: number,
  t: Translate,
): string {
  const glyphName = archetypeId ? getGlyphName(archetypeId) : undefined
  const stateKey = presenceStateKey(state, liveCount)
  const parts = [
    node.name,
    t(categoryLabelKey(node.category), categoryLabel(node.category)),
    ...(glyphName ? [glyphName] : []),
    t(stateKey, PLAIN_SCALE_EN[stateKey]),
  ]
  if (liveCount > 0 && state !== 'dormant') parts.push(`${liveCount} ${t(HERE_NOW_KEY, HERE_NOW_EN)}`)
  return parts.join(', ')
}
