/**
 * "Share my glyph" text payload (glyphcity-rebrand task 3.2).
 *
 * Validates: Requirements 3.2
 */
import { describe, expect, it } from 'vitest'

import { ARCHETYPE_CATALOG, UNCHARTED_ARCHETYPE_ID } from '../../constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME } from '../../constants/brand'
import { buildGlyphShareContent, resolveOwnGlyphId } from '../glyphShare'

describe('buildGlyphShareContent', () => {
  it('names every glyph with the brand and domain, never its description', () => {
    for (const archetype of ARCHETYPE_CATALOG) {
      const content = buildGlyphShareContent(archetype.id)
      expect(content.glyphName).toBe(archetype.name)
      expect(content.text).toContain(archetype.name)
      expect(content.text).toContain(APP_NAME)
      expect(content.url).toBe(`https://${APP_DOMAIN}`)
      expect(content.text).not.toContain(archetype.description)
    }
  })

  it('resolves a missing or unknown archetype to The Uncharted', () => {
    const uncharted = ARCHETYPE_CATALOG.find((a) => a.id === UNCHARTED_ARCHETYPE_ID)!
    for (const id of [null, undefined, '', 'archetype-not-real']) {
      expect(resolveOwnGlyphId(id)).toBe(UNCHARTED_ARCHETYPE_ID)
      expect(buildGlyphShareContent(id).glyphName).toBe(uncharted.name)
    }
  })
})
