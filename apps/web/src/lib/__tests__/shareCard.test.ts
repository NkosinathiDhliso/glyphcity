// @vitest-environment jsdom
/**
 * Rank and milestone share cards (glyphcity-rebrand task 12.2). jsdom has no 2D
 * canvas, so `getContext` returns a recording fake that keeps every drawn text
 * and every colour used to paint. Image decode is stubbed; the glyph SVG is real.
 *
 * Validates: Requirements 10.2, 5.2, 5.9
 */
import { ARCHETYPE_CATALOG, UNCHARTED_ARCHETYPE_ID } from '@area-code/shared/constants/archetype-catalog'
import { APP_DOMAIN, APP_NAME, BRAND_LINE } from '@area-code/shared/constants/brand'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildShareCardData, generateMilestoneCard, generateShareCard } from '../shareCard'
import { CARD_PALETTE } from '../shareCardPrimitives'

interface Recording {
  texts: string[]
  /** Colours in effect at each paint call (fillText, fillRect, fill, stroke). */
  paints: string[]
  images: number
}

let rec: Recording

function fakeContext(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = { fillStyle: '', strokeStyle: '' }
  const paint = (key: 'fillStyle' | 'strokeStyle') => () => {
    rec.paints.push(String(target[key]))
  }
  Object.assign(target, {
    fillText: (text: string) => {
      rec.texts.push(text)
      rec.paints.push(String(target['fillStyle']))
    },
    fillRect: paint('fillStyle'),
    fill: paint('fillStyle'),
    stroke: paint('strokeStyle'),
    drawImage: () => {
      rec.images += 1
    },
    measureText: (text: string) => ({ width: text.length * 10 }),
  })
  return new Proxy(target, {
    get: (t, key: string) => (key in t ? t[key] : () => {}),
    set: (t, key: string, value) => {
      t[key] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  rec = { texts: [], paints: [], images: 0 }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    fakeContext as unknown as HTMLCanvasElement['getContext'],
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
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

const PALETTE: string[] = Object.values(CARD_PALETTE)
const RETIRED_STATE_WORDS = /\b(Popping|Buzzing|Active|Dormant)\b/

const stats = (archetypeId: string | null) =>
  buildShareCardData({
    rank: 7,
    archetypeId,
    tier: 'legend',
    weeklyCheckInCount: 4,
    topVenueName: 'Fox Street Yard',
    displayName: 'Nomvula',
  })

describe('generateShareCard', () => {
  it('draws the wordmark, Brand_Line and APP_DOMAIN in the Outdoor_Palette only', async () => {
    await generateShareCard(stats('archetype-firecracker'))
    expect(rec.texts).toEqual(
      expect.arrayContaining([APP_NAME.toLowerCase(), BRAND_LINE, APP_DOMAIN, 'The Firecracker', '#7']),
    )
    expect(rec.paints.length).toBeGreaterThan(0)
    for (const colour of rec.paints) expect(PALETTE).toContain(colour)
    expect(rec.images).toBe(1)
  })

  it('names the glyph, never describes it, and draws no retired state word', async () => {
    for (const archetype of ARCHETYPE_CATALOG) {
      rec.texts = []
      await generateShareCard(stats(archetype.id))
      const drawn = rec.texts.join('\n')
      expect(rec.texts).toContain(archetype.name)
      expect(drawn).not.toContain(archetype.description)
      expect(drawn).not.toMatch(RETIRED_STATE_WORDS)
    }
  })

  it('resolves a missing archetype to The Uncharted', () => {
    const data = stats(null)
    expect(data.glyphId).toBe(UNCHARTED_ARCHETYPE_ID)
    expect(data.archetypeName).toBe('The Uncharted')
  })
})

describe('generateMilestoneCard', () => {
  it('draws the milestone in the shared frame with no slate or indigo', async () => {
    await generateMilestoneCard('7-day streak', 'Seven nights out')
    expect(rec.texts).toEqual(
      expect.arrayContaining([APP_NAME.toLowerCase(), BRAND_LINE, APP_DOMAIN, '7-day streak', 'Seven nights out']),
    )
    for (const colour of rec.paints) expect(PALETTE).toContain(colour)
  })
})
