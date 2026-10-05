import { describe, it, expect } from 'vitest'

import type { NodeState } from '../../types'
import * as barrel from '../index'
import { PLAIN_SCALE_EN, STATE_LABEL_KEY, nodeStateFromScore, stateLabelKey, toNodeState } from '../state-labels'

const ALL_STATES: NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']

/** Validates: Requirements 2.1, 2.2, 2.3. App en.json parity: state-labels.parity.property.test.ts */
describe('State_Labels', () => {
  it('holds the Plain_Scale keys and values', () => {
    expect(PLAIN_SCALE_EN).toEqual({
      'state.quiet': 'Quiet',
      'state.aLittleBusy': 'A little busy',
      'state.busy': 'Busy',
      'state.veryBusy': 'Very busy',
      'state.firstIn': 'Be the first in',
    })
  })

  it('maps every NodeState, with dormant showing no label', () => {
    expect(Object.keys(STATE_LABEL_KEY).sort()).toEqual([...ALL_STATES].sort())
    expect(STATE_LABEL_KEY.dormant).toBeNull()
    for (const state of ALL_STATES) {
      expect(PLAIN_SCALE_EN).toHaveProperty(stateLabelKey(state))
    }
    expect(stateLabelKey('dormant')).toBe('state.firstIn')
  })

  it('bands pulse scores at the Pulse_State thresholds', () => {
    expect(nodeStateFromScore(0)).toBe('dormant')
    expect(nodeStateFromScore(1)).toBe('quiet')
    expect(nodeStateFromScore(10)).toBe('quiet')
    expect(nodeStateFromScore(11)).toBe('active')
    expect(nodeStateFromScore(31)).toBe('buzzing')
    expect(nodeStateFromScore(60)).toBe('buzzing')
    expect(nodeStateFromScore(61)).toBe('popping')
  })

  it('narrows wire strings, reading unknowns as dormant', () => {
    for (const state of ALL_STATES) expect(toNodeState(state)).toBe(state)
    expect(toNodeState('warming')).toBe('dormant')
    expect(toNodeState(null)).toBe('dormant')
  })

  it('is re-exported from the constants barrel', () => {
    expect(barrel.PLAIN_SCALE_EN).toBe(PLAIN_SCALE_EN)
    expect(barrel.STATE_LABEL_KEY).toBe(STATE_LABEL_KEY)
    expect(barrel.stateLabelKey).toBe(stateLabelKey)
  })
})
