import { describe, it, expect } from 'vitest'

import {
  CONTRAST_PAIRS,
  checkRepo,
  composite,
  contrastRatio,
  evaluatePairs,
  failingPairs,
  parseColor,
  parseThemes,
  proposeDarkened,
  resolveToken,
} from './check-contrast.mjs'

// Unit tests for the token contrast guard (GlyphCity rebrand R5.3), plus the
// live-repo assertion that wires the guard into `pnpm test`.
//
// **Validates: Requirements 5.3**

describe('contrastRatio', () => {
  it('matches known WCAG pairs', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5)
  })

  it('is symmetric in foreground and background', () => {
    expect(contrastRatio('#13211b', '#edf0e8')).toBeCloseTo(contrastRatio('#edf0e8', '#13211b'), 10)
  })

  it('composites a translucent foreground before measuring', () => {
    expect(contrastRatio('rgba(0, 0, 0, 0)', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('rgba(0, 0, 0, 1)', '#ffffff')).toBeCloseTo(21, 5)
  })
})

describe('parseColor and composite', () => {
  it('parses hex and rgba forms', () => {
    expect(parseColor('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 })
    expect(parseColor('#00000080').a).toBeCloseTo(0.5, 2)
    expect(parseColor('rgba(19, 33, 27, 0.1)')).toEqual({ r: 19, g: 33, b: 27, a: 0.1 })
  })

  it('composites rgba over an opaque ground', () => {
    expect(composite(parseColor('rgba(255, 255, 255, 0.5)'), parseColor('#000000'))).toEqual({
      r: 128,
      g: 128,
      b: 128,
      a: 1,
    })
  })

  it('throws on values that are not colours', () => {
    expect(() => parseColor('linear-gradient(#fff, #000)')).toThrow(/Unresolvable/)
    expect(() => parseColor('tomato')).toThrow(/Unresolvable/)
  })
})

describe('parseThemes and resolveToken', () => {
  const css = `/* --bg-base: #ff0000; */
:root { --bg-base: #000000; --text-primary: #ffffff; --border: rgba(255, 255, 255, 0.5); --link: var(--text-primary); }
:root[data-theme='light'] { --bg-base: #ffffff; --text-primary: #000000; }`

  it('reads dark from :root and lets light inherit undeclared tokens', () => {
    const { dark, light } = parseThemes(css)
    expect(dark['--bg-base']).toBe('#000000')
    expect(light['--bg-base']).toBe('#ffffff')
    expect(light['--border']).toBe('rgba(255, 255, 255, 0.5)')
  })

  it('follows var() and composites translucent tokens over the ground', () => {
    const { dark } = parseThemes(css)
    expect(resolveToken(dark, '--link')).toBe('#ffffff')
    expect(resolveToken(dark, '--border', '#000000')).toBe('#808080')
  })

  it('throws on a missing block, a missing token or a non-colour value', () => {
    expect(() => parseThemes(':root { --a: #fff; }')).toThrow(/light/)
    const { dark } = parseThemes(css)
    expect(() => resolveToken(dark, '--nope')).toThrow(/not defined/)
    expect(() => resolveToken({ '--g': 'linear-gradient(#fff, #000)' }, '--g')).toThrow(/Unresolvable/)
    expect(() => resolveToken(dark, '--border')).toThrow(/translucent/)
  })

  it('fails a pair whose token cannot be resolved instead of skipping it', () => {
    const themes = parseThemes(css)
    expect(() => evaluatePairs(themes, [{ fg: '--missing', bg: '--bg-base', kind: 'text', use: 'x' }])).toThrow()
  })
})

describe('proposeDarkened', () => {
  it('returns a passing value on the same ground', () => {
    const fix = proposeDarkened('#e0a020', '#edf0e8', 4.5)
    expect(fix).not.toBeNull()
    expect(contrastRatio(fix as string, '#edf0e8')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('repo', () => {
  it('measures every pair in both themes', () => {
    expect(checkRepo()).toHaveLength(CONTRAST_PAIRS.length * 2)
  })

  it('has no enforced token pair below its WCAG minimum', () => {
    const failures = failingPairs(checkRepo()).map(
      (r) => `${r.theme} ${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} < ${r.min}`,
    )
    expect(failures).toEqual([])
  })
})
