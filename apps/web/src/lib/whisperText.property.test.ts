/**
 * Feature: GlyphCity rebrand, Property 2: label honesty (beam whisper).
 *
 * For any pulse score and live count, a whisper that carries a State_Label
 * never ranks above the pulse band (`nodeStateFromScore`, pinned to the
 * `pulse-decay.ts` bands in the shared property test), and zero presence never
 * whispers a busy label. No whisper claims capacity.
 *
 * **Validates: Requirements 2.6, 2.7**
 */

import { PLAIN_SCALE_EN, nodeStateFromScore, stateLabelKey } from '@area-code/shared/constants/state-labels'
import type { Node, VenueMomentum } from '@area-code/shared/types'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { computeWhisperText, type StateLabelTranslator } from './whisperText'

const translate: StateLabelTranslator = (key) => PLAIN_SCALE_EN[key]

const LABEL_RANK: Record<string, number> = {
  [PLAIN_SCALE_EN['state.firstIn']]: 0,
  [PLAIN_SCALE_EN['state.quiet']]: 1,
  [PLAIN_SCALE_EN['state.aLittleBusy']]: 2,
  [PLAIN_SCALE_EN['state.busy']]: 3,
  [PLAIN_SCALE_EN['state.veryBusy']]: 4,
}

const BUSY_LABELS = [
  PLAIN_SCALE_EN['state.aLittleBusy'],
  PLAIN_SCALE_EN['state.busy'],
  PLAIN_SCALE_EN['state.veryBusy'],
]

const CAPACITY_WORDS = /\b(packed|full|rammed)\b/i
const NAME = 'Test Venue'
const SUFFIX = ` \u00b7 ${NAME}`

const node = { id: 'node-1', name: NAME } as Node

const scoreArb = fc.double({ min: -50, max: 500, noNaN: true, noDefaultInfinity: true })
const liveArb = fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 500 }))
const momentumArb = fc.option(fc.constantFrom<VenueMomentum>('filling_up', 'winding_down', 'steady'), {
  nil: undefined,
})

function whisper(pulseScore: number, live: number, momentum: VenueMomentum | undefined): string | null {
  return computeWhisperText(
    'node-1',
    node,
    {
      pulseScores: { 'node-1': pulseScore },
      checkInCounts: { 'node-1': live },
      friendsAtVenue: {},
      momentum: momentum ? { 'node-1': momentum } : {},
    },
    translate,
  )
}

/** The State_Label a whisper carries, or null when it carries none. */
function stateLabelOf(text: string | null): string | null {
  if (text === null || !text.endsWith(SUFFIX)) return null
  const head = text.slice(0, -SUFFIX.length)
  return head in LABEL_RANK ? head : null
}

describe('Feature: GlyphCity rebrand, Property 2: label honesty', () => {
  it('whisper label never ranks above the pulse band, and zero presence is never busy', () => {
    fc.assert(
      fc.property(scoreArb, liveArb, momentumArb, (pulseScore, live, momentum) => {
        const text = whisper(pulseScore, live, momentum)
        const label = stateLabelOf(text)
        if (label !== null) {
          const band = LABEL_RANK[PLAIN_SCALE_EN[stateLabelKey(nodeStateFromScore(pulseScore))]] as number
          expect(LABEL_RANK[label]).toBeLessThanOrEqual(band)
        }
        if (live === 0) {
          expect(BUSY_LABELS).not.toContain(label)
        }
        expect(text ?? '').not.toMatch(CAPACITY_WORDS)
      }),
      { numRuns: 300 },
    )
  })
})
