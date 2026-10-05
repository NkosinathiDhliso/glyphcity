/**
 * Canvas primitives shared by the share cards (`shareCard.ts`,
 * `glyphShareCard.ts`): canvas setup, font loading from the type tokens,
 * ground and grain, text fitting, SVG images and PNG export. Client-side only.
 */

/**
 * Fixed light Outdoor_Palette for every share card (glyphcity-rebrand R10):
 * Lichen ground, Bush ink and secondary ink. Fixed rather than themed so a card
 * reads the same on light and dark chat backgrounds. Chrome is ink only.
 */
export const CARD_PALETTE = {
  ground: '#EDF0E8',
  ink: '#13211B',
  inkSecondary: '#4A5A50',
} as const

export interface CardFonts {
  display: string
  body: string
  mono: string
}

/**
 * Font stacks read from the type tokens in packages/shared/tokens.css, since
 * canvas cannot resolve CSS vars. Waits for the web fonts so text drawn on the
 * canvas does not silently render in the system fallback.
 */
export async function loadCardFonts(): Promise<CardFonts> {
  const style = getComputedStyle(document.documentElement)
  const read = (token: string): string => {
    const value = style.getPropertyValue(token).trim()
    if (!value) throw new Error(`Share card: missing ${token} token`)
    return value
  }
  const fonts = { display: read('--font-display'), body: read('--font-body'), mono: read('--font-mono') }
  await Promise.all([
    document.fonts.load(`700 48px ${fonts.display}`),
    document.fonts.load(`800 48px ${fonts.display}`),
    document.fonts.load(`400 20px ${fonts.body}`),
    document.fonts.load(`600 20px ${fonts.body}`),
    document.fonts.load(`500 16px ${fonts.mono}`),
  ])
  return fonts
}

/** A canvas of the given size and its 2D context. Throws when 2D is unsupported. */
export function createCardCanvas(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Share card: canvas 2D context unavailable')
  return { canvas, ctx }
}

/** Flat ground fill over the whole card. */
export function fillGround(ctx: CanvasRenderingContext2D, width: number, height: number, colour: string): void {
  ctx.fillStyle = colour
  ctx.fillRect(0, 0, width, height)
}

/** Grain speck density: one speck per this many square pixels. */
const GRAIN_AREA_PER_SPECK = 900
const GRAIN_ALPHA = 0.05

/**
 * Decorative grain in the ink colour, matching the app's noise overlay at low
 * alpha so text contrast is unaffected. Seeded, so the same card renders the
 * same grain every time.
 */
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colour: string,
  seed = 1,
): void {
  let state = seed >>> 0 || 1
  const next = (): number => {
    // xorshift32: small, deterministic, good enough for decorative noise.
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0xffffffff
  }
  const specks = Math.round((width * height) / GRAIN_AREA_PER_SPECK)
  ctx.save()
  ctx.globalAlpha = GRAIN_ALPHA
  ctx.fillStyle = colour
  for (let i = 0; i < specks; i++) {
    const size = next() < 0.5 ? 1 : 2
    ctx.fillRect(Math.floor(next() * width), Math.floor(next() * height), size, size)
  }
  ctx.restore()
}

/** Draw a rounded rectangle path (does not fill/stroke - caller does that). */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Truncate text with ellipsis if it exceeds maxWidth. */
export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

/** Decode an SVG string into an image ready for `drawImage`. */
export async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  return img
}

/** Export the canvas as a PNG Blob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))), 'image/png')
  })
}
