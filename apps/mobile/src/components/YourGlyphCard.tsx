import { ARCHETYPE_CATALOG } from '@area-code/shared/constants/archetype-catalog'
import { buildGlyphShareContent, resolveOwnGlyphId } from '@area-code/shared/lib/glyphShare'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, TouchableOpacity, StyleSheet, Share, ActivityIndicator } from 'react-native'

import { colors } from '../theme'

import { ArchetypeIcon } from './ArchetypeIcon'

const PROFILE_GLYPH_SIZE = 60

interface YourGlyphCardProps {
  archetypeId: string | null | undefined
}

/**
 * The user's own glyph on the mobile profile (glyphcity-rebrand R3.2): "Your
 * glyph", the glyph in ink, the Glyph_Name and "Share my glyph". Mirrors the
 * web YourGlyphCard. Names the glyph, never explains it.
 */
export function YourGlyphCard({ archetypeId }: YourGlyphCardProps) {
  const { t } = useTranslation()
  const [sharing, setSharing] = useState(false)
  const glyphId = resolveOwnGlyphId(archetypeId)
  const iconId = ARCHETYPE_CATALOG.find((a) => a.id === glyphId)?.iconId
  const { glyphName, text, url } = buildGlyphShareContent(glyphId)

  async function handleShare() {
    setSharing(true)
    try {
      // TODO(glyphcity-rebrand 12.1): attach the glyph share card image.
      await Share.share({ message: `${text}\n${url}` })
    } finally {
      setSharing(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t('profile.yourGlyph')}
      </Text>
      <View style={styles.row}>
        <ArchetypeIcon iconId={iconId} size={PROFILE_GLYPH_SIZE} color={colors.textPrimary} />
        <Text style={styles.name}>{glyphName}</Text>
      </View>
      <TouchableOpacity
        style={[styles.shareButton, sharing && styles.shareButtonDisabled]}
        onPress={() => void handleShare()}
        disabled={sharing}
        accessibilityRole="button"
        accessibilityState={{ disabled: sharing, busy: sharing }}
      >
        {sharing ? (
          <ActivityIndicator color={colors.bgBase} />
        ) : (
          <Text style={styles.shareText}>{t('profile.shareMyGlyph')}</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 },
  shareButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  shareButtonDisabled: { opacity: 0.5 },
  shareText: { color: colors.bgBase, fontSize: 14, fontWeight: '600' },
})
