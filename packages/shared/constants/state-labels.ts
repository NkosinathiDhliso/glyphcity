/**
 * State_Labels: the one home for the displayed word of each `NodeState`
 * (Requirement 2.1). Ids (`dormant`, `quiet`, `active`, `buzzing`, `popping`)
 * never change; only the words do, through i18n keys (Requirement 2.2).
 *
 * Pure and dependency-free so the backend (which has no i18next) can import
 * `PLAIN_SCALE_EN` directly via `@area-code/shared/constants/state-labels`.
 */

import type { NodeState } from '../types'

/** i18n key for the "Be the first in" invite shown instead of a dormant label. */
export const FIRST_IN_KEY = 'state.firstIn' as const

/**
 * State_Label key per `NodeState`. `dormant` is `null`: a dormant venue shows
 * no State_Label (Requirement 2.3). Use `stateLabelKey` where text is needed.
 */
export const STATE_LABEL_KEY: Record<NodeState, string | null> = {
  dormant: null,
  quiet: 'state.quiet',
  active: 'state.aLittleBusy',
  buzzing: 'state.busy',
  popping: 'state.veryBusy',
}

/** Plain_Scale in English. Mirrored in the web `en.json` (parity is tested). */
export const PLAIN_SCALE_EN = {
  'state.quiet': 'Quiet',
  'state.aLittleBusy': 'A little busy',
  'state.busy': 'Busy',
  'state.veryBusy': 'Very busy',
  [FIRST_IN_KEY]: 'Be the first in',
} as const

export type StateLabelKey = keyof typeof PLAIN_SCALE_EN

/**
 * Key for surfaces that must render text. Dormant has no State_Label, so it
 * returns the invite key (Requirement 2.3).
 */
export function stateLabelKey(state: NodeState): StateLabelKey {
  const key = STATE_LABEL_KEY[state]
  return key === null ? FIRST_IN_KEY : (key as StateLabelKey)
}

/**
 * State key under honest presence (honest-presence.md), the one rule shared by
 * the accessible node name and the share snapshot:
 * - nobody there and the pulse is dormant: the invite "Be the first in";
 * - nobody there but residual pulse: quiet, never the busier band;
 * - somebody there on a dormant pulse: quiet, never the invite;
 * - otherwise the Plain_Scale key for the state.
 */
export function presenceStateKey(state: NodeState, liveCount: number): StateLabelKey {
  if (liveCount <= 0) return state === 'dormant' ? FIRST_IN_KEY : stateLabelKey('quiet')
  return stateLabelKey(state === 'dormant' ? 'quiet' : state)
}

const NODE_STATES: readonly NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']

/** Narrow a wire string to a `NodeState`. Anything unknown reads as dormant (the invite). */
export function toNodeState(state: string | null | undefined): NodeState {
  return (NODE_STATES as readonly string[]).includes(state ?? '') ? (state as NodeState) : 'dormant'
}

/** Pulse_State bands by pulse score, descending (same bands as `pulse-decay.ts`). */
const NODE_STATE_THRESHOLDS: ReadonlyArray<{ min: number; state: NodeState }> = [
  { min: 61, state: 'popping' },
  { min: 31, state: 'buzzing' },
  { min: 11, state: 'active' },
  { min: 1, state: 'quiet' },
]

/** The `NodeState` a pulse score reads as. */
export function nodeStateFromScore(score: number): NodeState {
  for (const t of NODE_STATE_THRESHOLDS) {
    if (score >= t.min) return t.state
  }
  return 'dormant'
}
