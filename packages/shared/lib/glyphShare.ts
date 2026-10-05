import { getGlyphName, UNCHARTED_ARCHETYPE_ID } from '../constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME, BRAND_LINE } from '../constants/brand'

export interface GlyphShareContent {
  /** The Glyph_Name, never a description. */
  glyphName: string
  text: string
  url: string
}

/** The archetype id the profile shows: the user's own, or The Uncharted. */
export function resolveOwnGlyphId(archetypeId: string | null | undefined): string {
  return archetypeId && getGlyphName(archetypeId) ? archetypeId : UNCHARTED_ARCHETYPE_ID
}

/**
 * Text payload for "Share my glyph" (glyphcity-rebrand R3.2). Names the glyph,
 * never explains it: the catalog `description` is not read. An unknown or
 * missing archetype resolves to The Uncharted.
 */
export function buildGlyphShareContent(archetypeId: string | null | undefined): GlyphShareContent {
  const glyphName = getGlyphName(resolveOwnGlyphId(archetypeId))
  if (!glyphName) throw new Error('[glyphShare] archetype catalog is missing The Uncharted')
  return {
    glyphName,
    text: `My glyph on ${APP_NAME}: ${glyphName}. ${BRAND_LINE}`,
    url: `https://${APP_DOMAIN}`,
  }
}
