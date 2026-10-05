/**
 * Share card generator - client-side canvas rendering (R14.4: no Lambda).
 *
 * `buildShareCardData` is pure: it distils only the generating consumer's own
 * stats into the card payload. This is the Property 9 (Share Card Privacy)
 * target - it must never copy a foreign user's id/name/avatar/history into its
 * output, even when such data is available in the calling scope.
 *
 * `generateShareCard` renders from its output into an HTML5 Canvas and returns
 * a PNG Blob suitable for the Web Share API.
 */

import { getTierLabel } from '@area-code/shared/constants'
import { getGlyphName } from '@area-code/shared/constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME, APP_URL, BRAND_LINE } from '@area-code/shared/constants/brand'
import { resolveOwnGlyphId } from '@area-code/shared/lib/glyphShare'
import type { Tier } from '@area-code/shared/types'

import { buildGlyphSvg } from './glyphShareCard'
import {
  CARD_PALETTE,
  canvasToPngBlob,
  createCardCanvas,
  drawGrain,
  fillGround,
  loadCardFonts,
  loadSvgImage,
  roundRect,
  truncateText,
  type CardFonts,
} from './shareCardPrimitives'

const { ground: GROUND, ink: INK, inkSecondary: INK_SECONDARY } = CARD_PALETTE

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Input from the consumer's own profile/stats. May contain more fields than
 * needed - `buildShareCardData` distils only the safe subset.
 */
export interface ConsumerStats {
  rank: number
  archetypeId: string | null
  tier: Tier
  weeklyCheckInCount: number
  topVenueName: string | null
  /** Consumer's own display name (shown on card). */
  displayName?: string
}

/**
 * The pure, minimal payload rendered onto the share card.
 * Contains ONLY the generating consumer's own data (Property 9).
 */
export interface ShareCardData {
  rank: number
  archetypeId: string | null
  /** The glyph drawn in ink: the user's own, or The Uncharted. */
  glyphId: string
  /** The Glyph_Name, never a description. */
  archetypeName: string
  tier: Tier
  tierLabel: string
  weeklyCheckInCount: number
  topVenueName: string | null
  displayName: string | null
}

// ─── Pure data builder (Property 9 target) ───────────────────────────────────

/**
 * Distils only the generating consumer's own stats into the card payload.
 *
 * This function is intentionally minimal and takes a single `ConsumerStats`
 * object - it never accepts other users' data as input, making it structurally
 * impossible for foreign PII to leak into the output.
 */
export function buildShareCardData(stats: ConsumerStats): ShareCardData {
  // Same resolution as the "my glyph" card: an unknown archetype is The Uncharted.
  const glyphId = resolveOwnGlyphId(stats.archetypeId)
  const archetypeName = getGlyphName(glyphId)
  if (!archetypeName) throw new Error('[shareCard] archetype catalog is missing The Uncharted')

  return {
    rank: stats.rank,
    archetypeId: stats.archetypeId,
    glyphId,
    archetypeName,
    tier: stats.tier,
    tierLabel: getTierLabel(stats.tier),
    weeklyCheckInCount: stats.weeklyCheckInCount,
    topVenueName: stats.topVenueName,
    displayName: stats.displayName ?? null,
  }
}

// ─── Canvas renderer ─────────────────────────────────────────────────────────

/** Card dimensions optimised for Instagram/WhatsApp stories (9:16 portrait). */
const CARD_WIDTH = 540
const CARD_HEIGHT = 960
const CENTRE_X = CARD_WIDTH / 2
const TEXT_WIDTH = CARD_WIDTH - 80
const GLYPH_SIZE = 120

/**
 * Outdoor_Palette ground, grain, the lowercase wordmark on top and the
 * Brand_Line plus `APP_DOMAIN` at the foot. Shared by both cards so the frame
 * has one home. Chrome is ink only (glyphcity-rebrand R5.2, R10.2).
 */
function drawCardFrame(ctx: CanvasRenderingContext2D, f: CardFonts): void {
  fillGround(ctx, CARD_WIDTH, CARD_HEIGHT, GROUND)
  drawGrain(ctx, CARD_WIDTH, CARD_HEIGHT, INK)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `800 32px ${f.display}`
  ctx.fillText(APP_NAME.toLowerCase(), CENTRE_X, 70)

  ctx.font = `600 22px ${f.body}`
  ctx.fillText(BRAND_LINE, CENTRE_X, CARD_HEIGHT - 80)
  ctx.fillStyle = INK_SECONDARY
  ctx.font = `500 16px ${f.mono}`
  ctx.fillText(APP_DOMAIN, CENTRE_X, CARD_HEIGHT - 45)
}

/** Draw `text` centred at `y` in the given font and colour, truncated to the card. */
function centredText(ctx: CanvasRenderingContext2D, text: string, y: number, font: string, colour: string): void {
  ctx.font = font
  ctx.fillStyle = colour
  ctx.fillText(truncateText(ctx, text, TEXT_WIDTH), CENTRE_X, y)
}

/** Tier badge: an ink outline pill with the tier word in ink. */
function drawTierBadge(ctx: CanvasRenderingContext2D, f: CardFonts, label: string, y: number): void {
  ctx.font = `600 22px ${f.body}`
  const w = ctx.measureText(label).width + 40
  const h = 52
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  roundRect(ctx, (CARD_WIDTH - w) / 2, y - h / 2 - 8, w, h, 18)
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.fillText(label, CENTRE_X, y + 8)
}

/**
 * Renders the rank share card from `ShareCardData`: the user's glyph in ink with
 * its Glyph_Name, rank, tier, weekly count and top venue. Returns a PNG Blob for
 * the Web Share API. Draws no live-state word.
 */
export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const f = await loadCardFonts()
  const { canvas, ctx } = createCardCanvas(CARD_WIDTH, CARD_HEIGHT)
  drawCardFrame(ctx, f)

  const glyph = await loadSvgImage(buildGlyphSvg(data.glyphId, GLYPH_SIZE, INK, GROUND))
  ctx.drawImage(glyph, CENTRE_X - GLYPH_SIZE / 2, 100, GLYPH_SIZE, GLYPH_SIZE)

  centredText(ctx, data.archetypeName, 260, `700 28px ${f.display}`, INK)
  centredText(ctx, `#${data.rank}`, 370, `700 96px ${f.display}`, INK)
  centredText(ctx, 'This Week', 405, `400 20px ${f.body}`, INK_SECONDARY)

  drawTierBadge(ctx, f, data.tierLabel, 470)

  centredText(ctx, `${data.weeklyCheckInCount}`, 580, `700 48px ${f.display}`, INK)
  centredText(ctx, 'check-ins this week', 610, `400 18px ${f.body}`, INK_SECONDARY)

  if (data.topVenueName) {
    centredText(ctx, 'Powered by', 680, `400 16px ${f.body}`, INK_SECONDARY)
    centredText(ctx, data.topVenueName, 715, `600 24px ${f.body}`, INK)
  }

  if (data.displayName) {
    centredText(ctx, data.displayName, 790, `500 20px ${f.body}`, INK_SECONDARY)
  }

  return canvasToPngBlob(canvas)
}

/**
 * Render a milestone share card (e.g. "7-day streak", "Moved up to Patron")
 * in the same frame. Contains only the milestone text, so it exposes no other
 * user's data (R11.5.3).
 */
export async function generateMilestoneCard(title: string, body: string): Promise<Blob> {
  const f = await loadCardFonts()
  const { canvas, ctx } = createCardCanvas(CARD_WIDTH, CARD_HEIGHT)
  drawCardFrame(ctx, f)

  centredText(ctx, title, CARD_HEIGHT / 2 - 20, `700 52px ${f.display}`, INK)
  centredText(ctx, body, CARD_HEIGHT / 2 + 30, `400 24px ${f.body}`, INK_SECONDARY)

  return canvasToPngBlob(canvas)
}

// ─── Share / copy (Web Share API with clipboard fallback) ───────────────────

/**
 * Deep link included in every share so external viewers can discover the app.
 * Points at the live web app, which prompts install on unsupported platforms
 * (R12.3, R14.2). Override via `VITE_APP_SHARE_URL` per environment.
 */
export const APP_SHARE_URL = (import.meta.env?.['VITE_APP_SHARE_URL'] as string | undefined) ?? APP_URL

/**
 * Share a generated card via the Web Share API when available, falling back to
 * copying a text summary + deep link to the clipboard.
 *
 * The image file is only attached when the platform reports it can share files
 * (`navigator.canShare`), otherwise we share text + url so the call never
 * rejects on unsupported file payloads. Any failure (including the user
 * dismissing the sheet) degrades to the clipboard path.
 *
 * Requirements: 10.3.3, 10.3.4, 11.5.4, 12.3
 */
export async function shareOrCopy(
  blob: Blob | null,
  text: string,
  url: string = APP_SHARE_URL,
  fileName = `${APP_NAME.toLowerCase()}.png`,
): Promise<void> {
  // A null blob shares text and url only.
  const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  if (nav?.share) {
    const canShareFiles = file !== null && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
    try {
      await nav.share(canShareFiles && file ? { text, url, files: [file] } : { text, url })
      return
    } catch (err) {
      // AbortError = user dismissed the sheet; do not fall through to clipboard.
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Any other failure falls through to the clipboard path below.
    }
  }

  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(`${text}\n${url}`)
  }
}
