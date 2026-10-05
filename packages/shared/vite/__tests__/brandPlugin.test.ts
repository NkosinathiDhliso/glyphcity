import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { APP_NAME, SPOKEN_NAME } from '../../constants/brand'
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
