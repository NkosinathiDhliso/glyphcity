import { describe, it, expect } from 'vitest'

import { toSASTDate } from './streak.js'

describe('toSASTDate', () => {
  it('rolls an early-morning UTC time into the SAST calendar day', () => {
    // 2026-01-01T23:30Z is 2026-01-02 01:30 SAST.
    expect(toSASTDate('2026-01-01T23:30:00.000Z')).toBe('2026-01-02')
  })

  it('keeps a mid-day UTC time on the same SAST day', () => {
    expect(toSASTDate('2026-03-10T09:00:00.000Z')).toBe('2026-03-10')
  })
})
