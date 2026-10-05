/**
 * "My glyph" share card (glyphcity-rebrand R10.1): client-side canvas render of
 * the user's own glyph in ink, the Glyph_Name, the wordmark, the Brand_Line and
 * `APP_DOMAIN`, plus the user's chosen display name when they have one.
 *
 * Names the glyph, never explains it: the catalog `description` is never read.
 * No tier, counts or location are drawn.
 *
 * Colours are fixed to the light Outdoor_Palette (Lichen ground, Bush ink)
 * rather than the current theme, so the brand card reads the same everywhere
 * it lands and stays legible on light and dark chat backgrounds alike. The
 * outline pass uses the ground colour as the contrast colour against the ink.
 */

import { getArchetypeIcon } from '@area-code/shared/constants'
import { ARCHETYPE_CATALOG, getGlyphName } from '@area-code/shared/constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME, BRAND_LINE } from '@area-code/shared/constants/brand'
import { resolveOwnGlyphId } from '@area-code/shared/lib/glyphShare'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { resolveArchetypeIconComponent } from './archetypeIconComponents'
import {
  CARD_PALETTE,
  canvasToPngBlob,
  createCardCanvas,
  drawGrain,
  fillGround,
  loadCardFonts,
  loadSvgImage,
  truncateText,
  type CardFonts,
} from './shareCardPrimitives'

const { ground: GROUND, ink: INK, inkSecondary: INK_SECONDARY } = CARD_PALETTE

export interface GlyphCardSize {
  width: number
  height: number
}

/** Portrait card for stories and feeds, and the WhatsApp-friendly preview. */
export const GLYPH_CARD_SIZES = {
  portrait: { width: 1080, height: 1350 },
  preview: { width: 1200, height: 630 },
} as const satisfies Record<string, GlyphCardSize>

export interface GlyphCardData {
  glyphId: string
  /** The Glyph_Name, never a description. */
  glyphName: string
  /** The user's own chosen display name, or null to omit the line. */
  displayName: string | null
}

/**
 * Distil the card payload from the user's own archetype and display name.
 * Unknown or missing archetypes resolve to The Uncharted.
 */
export function buildGlyphCardData(archetypeId: string | null | undefined, displayName?: string | null): GlyphCardData {
  const glyphId = resolveOwnGlyphId(archetypeId)
  const glyphName = getGlyphName(glyphId)
  if (!glyphName) throw new Error('[glyphShareCard] archetype catalog is missing The Uncharted')
  const name = displayName?.trim()
  return { glyphId, glyphName, displayName: name ? name : null }
}

// ─── Glyph SVG ───────────────────────────────────────────────────────────────

/** Render the glyph's Phosphor icon once off-screen to read its viewBox and paths. */
function readIconMarkup(glyphId: string): { viewBox: string; inner: string } {
  const iconId = ARCHETYPE_CATALOG.find((a) => a.id === glyphId)?.iconId
  const spec = iconId ? getArchetypeIcon(iconId) : undefined
  const Component = spec ? resolveArchetypeIconComponent(spec.name) : null
  if (!spec || !Component) throw new Error(`[glyphShareCard] no icon for ${glyphId}`)

  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    flushSync(() => root.render(createElement(Component, { weight: spec.weight })))
    const svg = host.querySelector('svg')
    if (!svg) throw new Error(`[glyphShareCard] icon ${spec.name} rendered no svg`)
    return { viewBox: svg.getAttribute('viewBox') ?? '0 0 256 256', inner: svg.innerHTML }
  } finally {
    root.unmount()
  }
}

/**
 * The glyph as a standalone SVG: a stroked outline pass in the contrast colour
 * under a filled pass in ink. Stroke width follows `ArchetypeGlyph`:
 * `max(1, round(size * 0.12))` in icon units.
 */
export function buildGlyphSvg(glyphId: string, size: number, ink: string, outline: string): string {
  const { viewBox, inner } = readIconMarkup(glyphId)
  const strokeWidth = Math.max(1, Math.round(size * 0.12))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">` +
    `<g fill="${outline}" stroke="${outline}" stroke-width="${strokeWidth}" ` +
    `stroke-linejoin="round" stroke-linecap="round">${inner}</g>` +
    `<g fill="${ink}">${inner}</g></svg>`
  )
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

interface TextSlot {
  x: number
  y: number
  size: number
}

interface GlyphCardLayout {
  size: GlyphCardSize
  align: CanvasTextAlign
  /** Max text width for name lines. */
  textWidth: number
  glyph: { x: number; y: number; size: number }
  wordmark: TextSlot
  glyphName: TextSlot
  displayName: TextSlot
  brandLine: TextSlot
  domain: TextSlot
}

const PORTRAIT_LAYOUT: GlyphCardLayout = {
  size: GLYPH_CARD_SIZES.portrait,
  align: 'center',
  textWidth: 920,
  glyph: { x: 330, y: 300, size: 420 },
  wordmark: { x: 540, y: 160, size: 64 },
  glyphName: { x: 540, y: 880, size: 92 },
  displayName: { x: 540, y: 960, size: 40 },
  brandLine: { x: 540, y: 1180, size: 44 },
  domain: { x: 540, y: 1250, size: 32 },
}

const PREVIEW_LAYOUT: GlyphCardLayout = {
  size: GLYPH_CARD_SIZES.preview,
  align: 'left',
  textWidth: 620,
  glyph: { x: 90, y: 145, size: 340 },
  wordmark: { x: 500, y: 130, size: 48 },
  glyphName: { x: 500, y: 320, size: 76 },
  displayName: { x: 500, y: 380, size: 34 },
  brandLine: { x: 500, y: 490, size: 36 },
  domain: { x: 500, y: 550, size: 28 },
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: TextSlot,
  font: string,
  colour: string,
  maxWidth: number,
): void {
  ctx.font = font
  ctx.fillStyle = colour
  ctx.fillText(truncateText(ctx, text, maxWidth), slot.x, slot.y)
}

async function renderGlyphCard(data: GlyphCardData, layout: GlyphCardLayout): Promise<Blob> {
  const f: CardFonts = await loadCardFonts()
  const { width, height } = layout.size
  const { canvas, ctx } = createCardCanvas(width, height)

  fillGround(ctx, width, height, GROUND)
  drawGrain(ctx, width, height, INK)

  const glyph = await loadSvgImage(buildGlyphSvg(data.glyphId, layout.glyph.size, INK, GROUND))
  ctx.drawImage(glyph, layout.glyph.x, layout.glyph.y, layout.glyph.size, layout.glyph.size)

  ctx.textAlign = layout.align
  ctx.textBaseline = 'alphabetic'
  const w = layout.textWidth
  drawText(ctx, APP_NAME.toLowerCase(), layout.wordmark, `800 ${layout.wordmark.size}px ${f.display}`, INK, w)
  drawText(ctx, data.glyphName, layout.glyphName, `700 ${layout.glyphName.size}px ${f.display}`, INK, w)
  if (data.displayName) {
    const font = `500 ${layout.displayName.size}px ${f.body}`
    drawText(ctx, data.displayName, layout.displayName, font, INK_SECONDARY, w)
  }
  drawText(ctx, BRAND_LINE, layout.brandLine, `600 ${layout.brandLine.size}px ${f.body}`, INK, w)
  drawText(ctx, APP_DOMAIN, layout.domain, `500 ${layout.domain.size}px ${f.mono}`, INK_SECONDARY, w)

  return canvasToPngBlob(canvas)
}

/** The 1080 by 1350 "my glyph" card shared from the profile. */
export function generateGlyphShareCard(data: GlyphCardData): Promise<Blob> {
  return renderGlyphCard(data, PORTRAIT_LAYOUT)
}

/** The 1200 by 630 WhatsApp-friendly preview of the same card. */
export function generateGlyphPreviewCard(data: GlyphCardData): Promise<Blob> {
  return renderGlyphCard(data, PREVIEW_LAYOUT)
}
