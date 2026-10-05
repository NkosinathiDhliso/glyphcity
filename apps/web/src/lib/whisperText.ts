import { stateLabelKey, type StateLabelKey } from '@area-code/shared/constants/state-labels'
import type { Node, VenueMomentum } from '@area-code/shared/types'

import { getNodeState } from './mapHelpers'

/**
 * Pulse score threshold above which we consider a venue to have rising
 * momentum (filling up / buzzing). Aligned with the "buzzing" state
 * threshold in mapHelpers.
 */
const MOMENTUM_THRESHOLD = 31

/**
 * Resolves a State_Label key to display text. The rendering layer passes its
 * i18n `t`, so this module holds no state words (glyphcity-rebrand R2.1).
 */
export type StateLabelTranslator = (key: StateLabelKey) => string

/**
 * Computes the one-line magnet whisper for a brushed beam.
 *
 * Ranked per discovery-DNA hierarchy:
 *   1. Belonging: friends at venue (honest, real mutual-friend data)
 *   2. Momentum: the honest presence trend ("Filling up"), then high pulse
 *      (buzzing or popping state)
 *   3. Aliveness: fallback using the pulse State_Label
 *
 * Only `filling_up` whispers; `winding_down` is honest but is not a pull, so
 * the brush whisper says less rather than surfacing an anti-magnet (cards and
 * the venue detail still show it for comparison).
 *
 * Honest-presence compliant: never claims "your crowd" without real
 * friend presence data. Under-claims, never over-claims.
 */
export function computeWhisperText(
  nodeId: string,
  node: Node | undefined,
  mapState: {
    pulseScores: Record<string, number>
    checkInCounts: Record<string, number>
    friendsAtVenue: Record<string, string[]>
    momentum?: Record<string, VenueMomentum>
  },
  translate: StateLabelTranslator,
): string | null {
  if (!node) return null

  const name = node.name
  const friends = mapState.friendsAtVenue[nodeId]
  const pulseScore = mapState.pulseScores[nodeId] ?? 0
  const checkInCount = mapState.checkInCounts[nodeId] ?? 0
  const state = getNodeState(pulseScore)
  const label = (s: Parameters<typeof stateLabelKey>[0]) => `${translate(stateLabelKey(s))} \u00b7 ${name}`

  // 1. Belonging: real friends present (never fabricated)
  if (friends && friends.length > 0) {
    return `Your crowd \u00b7 ${name}`
  }

  // 2. Momentum: a measured rising trend beats a static pulse label. Backed by
  // the server-derived presence series (real arrivals), never fabricated.
  if (mapState.momentum?.[nodeId] === 'filling_up') {
    return `Filling up · ${name}`
  }

  // Then: buzzing/popping with real presence. Lingering pulse alone never reads busy.
  if (checkInCount > 0 && (pulseScore >= MOMENTUM_THRESHOLD || state === 'buzzing' || state === 'popping')) {
    return label(state === 'popping' ? 'popping' : 'buzzing')
  }

  // 3. Aliveness: active state with real presence
  if (state === 'active' && checkInCount > 0) {
    return label('active')
  }

  // Quiet or dormant: under-claim, honest signal
  if (state === 'quiet' && checkInCount > 0) {
    return label('quiet')
  }

  // Dormant: no whisper rather than fabricating activity
  return null
}
