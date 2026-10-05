// @vitest-environment jsdom
/**
 * "My glyph" share card (glyphcity-rebrand task 12.1). jsdom has no 2D canvas,
 * so `getContext` returns a recording fake and `toBlob` records the canvas
 * size it exported. Image decode is stubbed; the glyph SVG string is real.
 *
 * Validates: Requirements 10.1
 */
import { ARCHETYPE_CATALOG } from '@area-code/shared/constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME, BRAND_LINE } from '@area-code/shared/constants/brand'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildGlyphCardData,
  buildGlyphSvg,
  generateGlyphPreviewCard,
  generateGlyphShareCard,
  GLYPH_CARD_SIZES,
} from '../glyphShareCard'

interface Recording {
  texts: string[]
  images: number
  exported: Array<{ width: number; height: number }>
}

let rec: Recording

function fakeContext(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {
    fillText: (text: string) => rec.texts.push(text),
    drawImage: () => {
      rec.images += 1
    },
    measureText: (text: string) => ({ width: text.length * 10 }),
  }
  // Any other method is a no-op; property writes (font, fillStyle) are kept.
  return new Proxy(target, {
    get: (t, key: string) => (key in t ? t[key] : () => {}),
    set: (t, key: string, value) => {
      t[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  rec = { texts: [], images: 0, exported: [] }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    fakeContext as unknown as HTMLCanvasElement['getContext'],
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb) {
    rec.exported.push({ width: this.width, height: this.height })
    cb(new Blob(['png'], { type: 'image/png' }))
  })
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: () => Promise.resolve(), configurable: true })
  Object.defineProperty(document, 'fonts', { value: { load: () => Promise.resolve([]) }, configurable: true })
  document.documentElement.style.setProperty('--font-display', 'Funnel Display')
  document.documentElement.style.setProperty('--font-body', 'Funnel Sans')
  document.documentElement.style.setProperty('--font-mono', 'Geist Mono')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('glyphShareCard', () => {
  it('renders the portrait and preview cards at their sizes', async () => {
    const data = buildGlyphCardData('archetype-firecracker', 'Nomvula')
    const portrait = await generateGlyphShareCard(data)
    const preview = await generateGlyphPreviewCard(data)

    expect(portrait.type).toBe('image/png')
    expect(preview.type).toBe('image/png')
    expect(rec.exported).toEqual([
      { width: 1080, height: 1350 },
      { width: 1200, height: 630 },
    ])
    expect(GLYPH_CARD_SIZES.preview).toEqual({ width: 1200, height: 630 })
    expect(rec.images).toBe(2)
  })

  it('draws the Glyph_Name, wordmark, Brand_Line, domain and display name, never the description', async () => {
    for (const archetype of ARCHETYPE_CATALOG) {
      rec.texts = []
      await generateGlyphShareCard(buildGlyphCardData(archetype.id, 'Nomvula'))
      expect(rec.texts).toEqual(
        expect.arrayContaining([archetype.name, BRAND_LINE, APP_DOMAIN, APP_NAME.toLowerCase(), 'Nomvula']),
      )
      const drawn = rec.texts.join('\n')
      expect(drawn).not.toContain(archetype.description)
    }
  })

  it('omits the display name line when the user has none', async () => {
    const data = buildGlyphCardData('archetype-firecracker', '  ')
    expect(data.displayName).toBeNull()
    await generateGlyphShareCard(data)
    expect(rec.texts).toHaveLength(4)
  })

  it('resolves a missing archetype to The Uncharted', () => {
    expect(buildGlyphCardData(null).glyphName).toBe('The Uncharted')
  })

  it('builds the glyph as an outline pass under an ink fill with the ArchetypeGlyph stroke rule', () => {
    const svg = buildGlyphSvg('archetype-firecracker', 420, '#13211B', '#EDF0E8')
    expect(svg).toContain('stroke-width="50"') // round(420 * 0.12)
    expect(svg.indexOf('fill="#EDF0E8"')).toBeLessThan(svg.indexOf('fill="#13211B"'))
    expect(svg).toMatch(/<path d="M/)
  })
})
