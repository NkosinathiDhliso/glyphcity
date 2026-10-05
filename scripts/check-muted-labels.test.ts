import { describe, it, expect } from 'vitest'

import {
  classifyToken,
  countsOf,
  evaluateBaseline,
  findViolations,
  fontSizePx,
  isLabelClassSet,
  isScannedFile,
  readBaseline,
  scanRepo,
} from './check-muted-labels.mjs'

// Unit tests for the Muted_Labels guard (GlyphCity rebrand R5.3), plus the
// live-repo assertion that wires the guard into `pnpm test`.
//
// **Validates: Requirements 5.3**

const FILE = 'apps/web/src/components/Example.tsx'
const kinds = (src: string) => findViolations(src, FILE).map((v) => v.kind)

describe('isScannedFile', () => {
  it('scans app source and shared components, never tests', () => {
    expect(isScannedFile('apps/web/src/screens/MapScreen.tsx')).toBe(true)
    expect(isScannedFile('packages/shared/components/EmptyState.tsx')).toBe(true)
    expect(isScannedFile('apps/web/src/components/__tests__/X.tsx')).toBe(false)
    expect(isScannedFile('apps/web/src/components/X.test.tsx')).toBe(false)
    expect(isScannedFile('apps/web/src/lib/x.ts')).toBe(false)
  })
})

describe('fontSizePx and isLabelClassSet', () => {
  it('reads Tailwind font sizes', () => {
    expect(fontSizePx('text-xs')).toBe(12)
    expect(fontSizePx('text-[11px]')).toBe(11)
    expect(fontSizePx('text-[0.625rem]')).toBe(10)
    expect(fontSizePx('text-center')).toBeNull()
  })

  it('requires uppercase, font-mono and every size at 11px or more', () => {
    expect(isLabelClassSet(['uppercase', 'font-mono', 'text-[11px]'])).toBe(true)
    expect(isLabelClassSet(['uppercase', 'font-mono', 'text-sm'])).toBe(true)
    expect(isLabelClassSet(['uppercase', 'font-mono', 'text-[10px]'])).toBe(false)
    expect(isLabelClassSet(['uppercase', 'font-mono', 'text-xs', 'md:text-[9px]'])).toBe(false)
    expect(isLabelClassSet(['uppercase', 'text-xs'])).toBe(false)
    expect(isLabelClassSet(['uppercase', 'font-mono'])).toBe(false)
  })
})

describe('classifyToken', () => {
  it('separates text, exempt, non-text and raw uses', () => {
    expect(classifyToken('text-[var(--text-muted)]')).toBe('text')
    expect(classifyToken('placeholder:text-[var(--text-muted)]')).toBe('text')
    expect(classifyToken('disabled:text-[var(--text-muted)]')).toBe('exempt')
    expect(classifyToken('border-[var(--text-muted)]')).toBe('nontext')
    expect(classifyToken('var(--text-muted)')).toBe('raw')
  })
})

describe('findViolations', () => {
  it('passes labels and flags body text', () => {
    expect(kinds(`<p className="text-[var(--text-muted)] font-mono uppercase text-[11px]">A</p>`)).toEqual([])
    expect(kinds(`<p className="text-[var(--text-muted)] text-xs">Body</p>`)).toHaveLength(1)
    expect(kinds(`<p className="text-[var(--text-muted)] font-mono uppercase text-[10px]">A</p>`)).toHaveLength(1)
  })

  it('flags placeholders and exempts disabled variants', () => {
    expect(kinds(`<input className="text-sm placeholder:text-[var(--text-muted)]" />`)).toHaveLength(1)
    expect(kinds(`<button className="text-sm disabled:text-[var(--text-muted)]">x</button>`)).toEqual([])
  })

  it('allows icons: lucide components and aria-hidden svgs', () => {
    const lucide = `import { Moon } from 'lucide-react'\nconst a = <Moon className="text-[var(--text-muted)]" />`
    expect(kinds(lucide)).toEqual([])
    expect(kinds(`<svg aria-hidden="true" stroke="var(--text-muted)" />`)).toEqual([])
    expect(kinds(`<svg stroke="var(--text-muted)" />`)).toHaveLength(1)
  })

  it('evaluates template and conditional classNames from static parts', () => {
    const ok = 'const a = <span className={`uppercase font-mono text-xs ${on ? "x" : "text-[var(--text-muted)]"}`} />'
    expect(kinds(ok)).toEqual([])
    const bad = 'const a = <span className={`text-xs ${on ? "x" : "text-[var(--text-muted)]"}`} />'
    expect(kinds(bad)).toHaveLength(1)
  })

  it('flags class strings and colours it cannot evaluate statically', () => {
    expect(kinds(`const cls = 'text-[var(--text-muted)] text-xs'`)).toEqual([
      'dynamic class string (cannot evaluate statically)',
    ])
    expect(kinds(`function c() { return 'var(--text-muted)' }`)).toEqual(['unresolved colour (not tied to an element)'])
    expect(kinds(`<span style={{ color: 'var(--text-muted)' }}>x</span>`)).toHaveLength(1)
  })

  it('ignores non-text utilities and style properties', () => {
    expect(kinds(`<span className="border-2 border-[var(--text-muted)]" />`)).toEqual([])
    expect(kinds(`Object.assign(el.style, { background: 'var(--text-muted)' })`)).toEqual([])
  })
})

describe('repo', () => {
  it('has no muted-tone violations beyond the committed baseline', () => {
    const { violations } = scanRepo()
    expect(evaluateBaseline(readBaseline(), countsOf(violations))).toEqual([])
  })

  it('keeps consumer web, business and shared components fully fixed', () => {
    const deferred = Object.keys(readBaseline()).filter(
      (p) => !p.startsWith('apps/admin/') && !p.startsWith('apps/staff/') && !p.includes('PointMode'),
    )
    expect(deferred).toEqual([])
  })
})
