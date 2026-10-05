import { getGlyphName } from '@area-code/shared/constants/archetype-catalog'
import type { NodeCategory, NodeState } from '@area-code/shared/types'
import type { ReactNode } from 'react'

import { ArchetypeGlyph } from './ArchetypeGlyph'

/**
 * A venue's glyph with its Glyph_Name beside it (glyphcity-rebrand R3.1).
 *
 * Names the glyph, never explains it: the catalog `description` is not read.
 * An unknown archetype renders the glyph alone, no placeholder name. `children`
 * trails the name (e.g. the momentum badge).
 */
export interface GlyphNameplateProps {
  archetypeId: string
  pulseState: NodeState
  category: NodeCategory
  size: number
  /** Fill override passed to ArchetypeGlyph (e.g. ink on the profile). */
  silhouetteColour?: string
  children?: ReactNode
}

export function GlyphNameplate({
  archetypeId,
  pulseState,
  category,
  size,
  silhouetteColour,
  children,
}: GlyphNameplateProps) {
  const glyphName = getGlyphName(archetypeId)
  return (
    <div className="flex flex-row items-center gap-2 mb-3" data-glyph-nameplate={archetypeId}>
      {/* ArchetypeGlyph positions itself absolutely, so it sits in a sized box. */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ArchetypeGlyph
          archetypeId={archetypeId}
          pulseState={pulseState}
          category={category}
          size={size}
          silhouetteColour={silhouetteColour}
        />
      </div>
      {glyphName && (
        <span data-glyph-name className="text-[var(--text-primary)] text-sm font-medium">
          {glyphName}
        </span>
      )}
      {children}
    </div>
  )
}
