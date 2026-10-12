/**
 * Feature: North star alignment, Property 5 (type half): the Receipt cannot
 * see taste (north-star-alignment R6.3).
 *
 * Unlinking music must change nothing live. The honest form of that promise is
 * structural: `computeReceipt` takes check-ins that carry only who, when and
 * how they were found, so no taste field can ever reach an owner's number.
 */

import { describe, expectTypeOf, it } from 'vitest'

import type { computeReceipt, ReceiptCheckIn } from '../receipt'

describe('computeReceipt input (R6.3)', () => {
  it('takes check-ins with exactly userId, checkedInAt and foundVia', () => {
    expectTypeOf<keyof ReceiptCheckIn>().toEqualTypeOf<'userId' | 'checkedInAt' | 'foundVia'>()
  })

  it('reads its check-ins as ReceiptCheckIn', () => {
    expectTypeOf<Parameters<typeof computeReceipt>[0]>().toEqualTypeOf<readonly ReceiptCheckIn[]>()
  })
})
