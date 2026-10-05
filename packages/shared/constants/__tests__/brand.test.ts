import { describe, it, expect } from 'vitest'

import { APP_DOMAIN, APP_NAME, BRAND_LINE, COMPANY_NAME, SPOKEN_NAME } from '../brand'
import * as barrel from '../index'

/** Validates: Requirements 1.1 */
describe('Brand_Constants', () => {
  it('holds the Requirement 1.1 values', () => {
    expect(APP_NAME).toBe('GlyphCity')
    expect(SPOKEN_NAME).toBe('Glyph')
    expect(APP_DOMAIN).toBe('glyphcity.com')
    expect(COMPANY_NAME).toBe('Area Code')
    expect(BRAND_LINE).toBe('Check the beams.')
  })

  it('is re-exported from the constants barrel', () => {
    expect(barrel.APP_NAME).toBe(APP_NAME)
    expect(barrel.SPOKEN_NAME).toBe(SPOKEN_NAME)
    expect(barrel.APP_DOMAIN).toBe(APP_DOMAIN)
    expect(barrel.COMPANY_NAME).toBe(COMPANY_NAME)
    expect(barrel.BRAND_LINE).toBe(BRAND_LINE)
  })
})
