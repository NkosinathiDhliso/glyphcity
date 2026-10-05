import { describe, it, expect } from 'vitest'

import {
  countBrandHits,
  evaluateBaseline,
  isScannedFile,
  readBaseline,
  scanRepo,
  shrinkBaseline,
} from './check-brand-strings.mjs'

// Unit tests for the Brand_Strings guard core (GlyphCity rebrand R1.6), plus
// the live-repo assertion that wires the guard into `pnpm test`.
//
// **Validates: Requirements 1.6**

describe('isScannedFile', () => {
  it('scans the user-facing file list', () => {
    expect(isScannedFile('apps/web/src/i18n/locales/en.json')).toBe(true)
    expect(isScannedFile('apps/business/index.html')).toBe(true)
    expect(isScannedFile('apps/web/public/manifest.webmanifest')).toBe(true)
    expect(isScannedFile('backend/src/shared/email/ses.ts')).toBe(true)
    expect(isScannedFile('packages/shared/constants/legal-content.ts')).toBe(true)
    expect(isScannedFile('backend/src/features/nodes/share-snapshot.ts')).toBe(true)
    expect(isScannedFile('apps/web/src/lib/shareCard.ts')).toBe(true)
  })

  it('ignores brand.ts, tests, docs and specs', () => {
    expect(isScannedFile('packages/shared/constants/brand.ts')).toBe(false)
    expect(isScannedFile('backend/src/shared/email/ses.test.ts')).toBe(false)
    expect(isScannedFile('backend/src/shared/email/__tests__/ses.ts')).toBe(false)
    expect(isScannedFile('docs/DEPLOY.md')).toBe(false)
    expect(isScannedFile('.kiro/specs/glyphcity-rebrand/design.md')).toBe(false)
  })

  it('scans the task 1.2 widening: app source, shared components, flagged files', () => {
    expect(isScannedFile('apps/web/src/components/BottomNav.tsx')).toBe(true)
    expect(isScannedFile('apps/staff/src/screens/StaffHome.tsx')).toBe(true)
    expect(isScannedFile('apps/mobile/app/(tabs)/profile.tsx')).toBe(true)
    expect(isScannedFile('packages/shared/components/RedemptionCodeCard.tsx')).toBe(true)
    expect(isScannedFile('packages/shared/lib/imageCompression.ts')).toBe(true)
    expect(isScannedFile('backend/src/features/auth/service.ts')).toBe(true)
    expect(isScannedFile('backend/src/shared/cognito/client.ts')).toBe(true)
    expect(isScannedFile('apps/admin/public/robots.txt')).toBe(true)
    expect(isScannedFile('apps/web/public/sitemap.xml')).toBe(true)
  })

  it('ignores files outside the explicit list', () => {
    expect(isScannedFile('packages/shared/lib/api.ts')).toBe(false)
    expect(isScannedFile('backend/src/features/business/service.ts')).toBe(false)
  })
})

describe('countBrandHits', () => {
  it('catches every brand literal in a scanned file', () => {
    const text = `export const a = 'Area Code'
export const b = 'https://areacode.co.za/node/x'
export const c = 'GlyphCity'
export const d = 'https://glyphcity.com'
export const e = 'Check the beams.'`
    expect(countBrandHits(text, 'apps/web/src/lib/shareCard.ts')).toBe(5)
  })

  it('does not match SPOKEN_NAME or internal identifiers', () => {
    const text = `const glyph = 'Glyph'; const g = 'Your glyph'; const env = 'AREA_CODE_WEB_URL'`
    expect(countBrandHits(text, 'apps/web/src/lib/shareCard.ts')).toBe(0)
  })

  it('does not flag Brand_Constants imports, interpolation or @area-code/ paths', () => {
    const tsx = `import { APP_NAME } from '@area-code/shared/constants/brand'
import { api } from '@area-code/shared/lib/api'
const key = 'areacode.checkinOutbox.v1'
const a = <span>{APP_NAME}</span>
const b = t('x', 'Join {{appName}} today')`
    expect(countBrandHits(tsx, 'apps/web/src/screens/AuthLanding.tsx')).toBe(0)
  })

  it('ignores comments but keeps URLs in strings', () => {
    const ts = `// Area Code comment\n/* GlyphCity */\nconst u = 'https://areacode.co.za'`
    expect(countBrandHits(ts, 'backend/src/shared/email/ses.ts')).toBe(1)
    const html = `<!-- Area Code --><title>Area Code</title>`
    expect(countBrandHits(html, 'apps/web/index.html')).toBe(1)
  })
})

describe('evaluateBaseline', () => {
  const baseline = { 'a.json': 3, 'b.html': 1 }

  it('passes when live counts equal the baseline', () => {
    expect(evaluateBaseline(baseline, { 'a.json': 3, 'b.html': 1 })).toEqual([])
  })

  it('fails on a hit in a file not in the baseline', () => {
    const failures = evaluateBaseline(baseline, { 'a.json': 3, 'b.html': 1, 'c.ts': 1 })
    expect(failures).toEqual([{ path: 'c.ts', kind: 'new', count: 1 }])
  })

  it('fails when a count rises above its baseline', () => {
    const failures = evaluateBaseline(baseline, { 'a.json': 4, 'b.html': 1 })
    expect(failures).toEqual([{ path: 'a.json', kind: 'grew', count: 4, frozen: 3 }])
  })

  it('fails on stale entries (lower count or zero)', () => {
    const failures = evaluateBaseline(baseline, { 'a.json': 2 })
    expect(failures).toEqual([
      { path: 'a.json', kind: 'stale', count: 2, frozen: 3 },
      { path: 'b.html', kind: 'stale', count: 0, frozen: 1 },
    ])
  })

  it('treats an empty baseline as zero tolerance', () => {
    expect(evaluateBaseline({}, { 'a.json': 1 })).toEqual([{ path: 'a.json', kind: 'new', count: 1 }])
  })
})

describe('shrinkBaseline', () => {
  it('lowers stale counts and drops zeros', () => {
    expect(shrinkBaseline({ 'a.json': 3, 'b.html': 1 }, { 'a.json': 2 })).toEqual({ 'a.json': 2 })
  })

  it('refuses to run when it would raise the baseline', () => {
    expect(() => shrinkBaseline({ 'a.json': 3 }, { 'a.json': 4 })).toThrow(/Cannot shrink/)
    expect(() => shrinkBaseline({ 'a.json': 3 }, { 'a.json': 3, 'c.ts': 1 })).toThrow(/Cannot shrink/)
  })
})

describe('repo', () => {
  it('has no brand literals beyond the committed baseline', () => {
    const { hits } = scanRepo()
    expect(evaluateBaseline(readBaseline(), hits)).toEqual([])
  })
})
