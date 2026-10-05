import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { APP_NAME, SPOKEN_NAME } from '../../constants/brand'
import { THEME_GROUND } from '../../constants/theme-ground'
import { applyBrandTokens } from '../brandPlugin'

// **Validates: Requirements 1.2, 1.5**

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8')

describe('applyBrandTokens', () => {
  it('replaces the brand placeholders', () => {
    expect(applyBrandTokens('<title>%APP_NAME% Admin</title>')).toBe(`<title>${APP_NAME} Admin</title>`)
    expect(applyBrandTokens('%SPOKEN_NAME%')).toBe(SPOKEN_NAME)
  })

  it('fails loudly on an unknown brand placeholder', () => {
    expect(() => applyBrandTokens('%APP_TAGLINE%', 'index.html')).toThrow(/APP_TAGLINE/)
  })

  it('leaves Vite env placeholders alone', () => {
    expect(applyBrandTokens('%VITE_API_URL%')).toBe('%VITE_API_URL%')
  })
})

describe('theme ground colours (glyphcity-rebrand R5.1)', () => {
  /** `--bg-base` inside the first block opened by `selector`. */
  const bgBase = (css: string, selector: string) => {
    const block = css.slice(css.indexOf(`${selector} {`))
    return block.match(/--bg-base:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase()
  }

  it('THEME_GROUND matches --bg-base in tokens.css for both themes', () => {
    const css = read('packages/shared/tokens.css')
    expect(bgBase(css, ':root')).toBe(THEME_GROUND.dark)
    expect(bgBase(css, ":root[data-theme='light']")).toBe(THEME_GROUND.light)
  })

  it.each(['web', 'business', 'staff', 'admin'])('%s theme-color metas use the Outdoor_Palette ground', (app) => {
    const html = applyBrandTokens(read(`apps/${app}/index.html`))
    expect(html).toContain(`content="${THEME_GROUND.dark}" media="(prefers-color-scheme: dark)"`)
    expect(html).toContain(`content="${THEME_GROUND.light}" media="(prefers-color-scheme: light)"`)
    expect(html).not.toMatch(/#0c1018|#f0ece6/i)
  })

  it('web manifest colours match the Lichen icon ground', () => {
    const manifest = JSON.parse(applyBrandTokens(read('apps/web/public/manifest.webmanifest'))) as Record<
      string,
      unknown
    >
    expect(manifest['background_color']).toBe(THEME_GROUND.light)
    expect(manifest['theme_color']).toBe(THEME_GROUND.light)
  })
})

describe('app shells', () => {
  it.each(['web', 'business', 'staff', 'admin'])('%s index.html title reads APP_NAME', (app) => {
    const html = applyBrandTokens(read(`apps/${app}/index.html`))
    expect(html).toMatch(new RegExp(`<title>${APP_NAME}[^<]*</title>`))
    expect(html).not.toContain('Area Code')
  })

  it('web manifest: name is APP_NAME, short_name is SPOKEN_NAME', () => {
    const manifest = JSON.parse(applyBrandTokens(read('apps/web/public/manifest.webmanifest'))) as Record<
      string,
      unknown
    >
    expect(manifest['name']).toBe(APP_NAME)
    expect(manifest['short_name']).toBe(SPOKEN_NAME)
  })

  it('service worker push title falls back to APP_NAME', () => {
    const sw = applyBrandTokens(read('apps/web/public/sw.js'))
    expect(sw).toContain(`payload.title || '${APP_NAME}'`)
  })
})
