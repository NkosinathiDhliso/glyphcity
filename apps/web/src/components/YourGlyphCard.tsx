import { buildGlyphShareContent, resolveOwnGlyphId } from '@area-code/shared/lib/glyphShare'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildGlyphCardData, generateGlyphShareCard } from '../lib/glyphShareCard'
import { shareOrCopy } from '../lib/shareCard'

import { GlyphNameplate } from './GlyphNameplate'

/** Glyph size on the profile (design: 60px, in ink, standard outline pass). */
const PROFILE_GLYPH_SIZE = 60
/** Only selects the outline contrast colour; a user's glyph has no category. */
const PROFILE_GLYPH_OUTLINE_CATEGORY = 'nightlife' as const
const INK = 'var(--text-primary)'

interface YourGlyphCardProps {
  archetypeId: string | null | undefined
  /** The user's own chosen display name, drawn on the share card when set. */
  displayName?: string | null
}

/**
 * The user's own glyph on the profile (glyphcity-rebrand R3.2): "Your glyph",
 * the glyph in ink, the Glyph_Name and "Share my glyph". Names the glyph,
 * never explains it: no description, no taste bars.
 */
export function YourGlyphCard({ archetypeId, displayName }: YourGlyphCardProps) {
  const { t } = useTranslation()
  const [sharing, setSharing] = useState(false)
  const glyphId = resolveOwnGlyphId(archetypeId)

  async function handleShare() {
    setSharing(true)
    try {
      const { text, url } = buildGlyphShareContent(glyphId)
      const card = await generateGlyphShareCard(buildGlyphCardData(glyphId, displayName))
      // Attaches the card when the platform can share files, else shares text and url.
      await shareOrCopy(card, text, url)
    } finally {
      setSharing(false)
    }
  }

  return (
    <section
      data-your-glyph
      className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-3"
      aria-labelledby="your-glyph-heading"
    >
      <h2
        id="your-glyph-heading"
        className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wider mb-3"
      >
        {t('profile.yourGlyph')}
      </h2>
      <GlyphNameplate
        archetypeId={glyphId}
        pulseState="active"
        category={PROFILE_GLYPH_OUTLINE_CATEGORY}
        size={PROFILE_GLYPH_SIZE}
        silhouetteColour={INK}
      />
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={sharing}
        aria-busy={sharing}
        className="w-full min-h-11 bg-[var(--accent-cta)] text-[var(--on-accent)] rounded-xl py-3 text-sm font-medium disabled:opacity-50 transition-all active:scale-95"
      >
        {t('profile.shareMyGlyph')}
      </button>
    </section>
  )
}
