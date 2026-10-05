import { getGlyphName } from '../constants/archetype-catalog'
import { categoryLabel, categoryLabelKey } from '../constants/node-categories'
import { FIRST_IN_KEY, PLAIN_SCALE_EN, stateLabelKey, type StateLabelKey } from '../constants/state-labels'
import type { NodeCategory, NodeState } from '../types'

/** i18n translator shape: key plus English default. Matches i18next `t(key, default)`. */
export type Translate = (key: string, defaultValue: string) => string

/** Count suffix key, shared with the venue card ("12 here now"). */
const HERE_NOW_KEY = 'venueCard.hereNow'
const HERE_NOW_EN = 'here now'

/**
 * The state segment under honest presence (honest-presence.md, same rule as
 * the share snapshot):
 * - nobody there and the pulse is dormant: the invite "Be the first in";
 * - nobody there but residual pulse: "Quiet", never the busier band;
 * - somebody there on a dormant pulse: "Quiet", never the invite;
 * - otherwise the Plain_Scale label for the state.
 */
function presenceStateKey(state: NodeState, liveCount: number): StateLabelKey {
  if (liveCount <= 0) return state === 'dormant' ? FIRST_IN_KEY : stateLabelKey('quiet')
  return stateLabelKey(state === 'dormant' ? 'quiet' : state)
}

/**
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
