// Token contrast guard (GlyphCity rebrand R5.3, task 7.1).
//
// Parses `packages/shared/tokens.css`, resolves every token named in
// CONTRAST_PAIRS to an opaque colour for both themes, and checks the WCAG 2.2
// contrast ratio of each pair:
//
//   - text  4.5:1  SC 1.4.3 body text, links, ink on grounds, CTA labels
//   - label 3:1    `--text-muted`, allowed only on 11px uppercase mono labels
//                  or larger (task 7.2 enforces the usage side)
//   - ui    3:1    SC 1.4.11 non-text contrast: focus ring, control boundaries
//   - edge  3:1    measured and printed, not enforced: a decorative edge on a
//                  control already identified by its text label. Promote to
//                  `ui` the moment a component relies on it alone to show a
//                  control or its state.
//
// Themes: `:root` is dark; `:root[data-theme='light']` overrides it, so light
// inherits any token it does not redeclare. Translucent foregrounds (rgba
// borders, text) are composited over their background; a translucent
// background is composited over `--bg-base` first. Any value that does not
// resolve to a colour (gradient, missing token, unknown syntax) throws: a pair
// that cannot be measured is a failure, never a skip.
//
// Usage (from the repo root):
//   node scripts/check-contrast.mjs   # prints the ratio table; non-zero exit on failure
//
// Wired into `pnpm test` through scripts/check-contrast.test.ts (live repo
// assertion) and runnable alone as `pnpm guard:contrast`. The pure functions
// are exported so the unit test can exercise them against fixture strings.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

export const TOKENS_PATH = join(REPO_ROOT, 'packages', 'shared', 'tokens.css')

/** Minimum ratio per pair kind. */
export const MIN_RATIO = { text: 4.5, label: 3, ui: 3, edge: 3 }

/** Kinds whose failure is reported but does not fail the check. */
export const ADVISORY_KINDS = new Set(['edge'])

/** Opaque grounds text and controls sit on. */
export const GROUNDS = ['--bg-base', '--bg-surface', '--bg-raised', '--bg-modal']

const on = (fg, bgs, kind, use) => bgs.map((bg) => ({ fg, bg, kind, use }))

/**
 * The one pair table. Extend it here when a token gains a text or control
 * role (task 7.2 and future tokens).
 *
 * @type {Array<{ fg: string, bg: string, kind: 'text' | 'label' | 'ui' | 'edge', use: string }>}
 */
export const CONTRAST_PAIRS = [
  ...on('--text-primary', GROUNDS, 'text', 'body text'),
  ...on('--text-secondary', GROUNDS, 'text', 'secondary text'),
  ...on('--accent', GROUNDS, 'text', 'ink text and links'),
  ...on('--on-accent', ['--accent', '--accent-cta'], 'text', 'CTA label'),
  ...on('--danger', ['--bg-base'], 'text', 'semantic text'),
  ...on('--success', ['--bg-base'], 'text', 'semantic text'),
  ...on('--warning', ['--bg-base'], 'text', 'semantic text'),
  ...on('--text-muted', GROUNDS, 'label', 'labels only'),
  ...on('--accent', GROUNDS, 'ui', 'focus ring'),
  // Edge only today: outline buttons that carry a text label, the sheet
  // grabber, and an aria-hidden "not done" ring whose done state is a filled
  // ink disc. None relies on the border alone (SC 1.4.11).
  ...on('--border-strong', GROUNDS, 'edge', 'outline edge on labelled controls'),
]

// ---------------------------------------------------------------------------
// Colour math (WCAG 2.2 relative luminance and contrast ratio)
// ---------------------------------------------------------------------------

/**
 * Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()` into channels.
 * Throws on anything else.
 *
 * @param {string} value
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function parseColor(value) {
  const v = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.replace(/./g, (c) => c + c)
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a }
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/.exec(v)
  if (fn) {
    const alpha = fn[4] === undefined ? 1 : fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : parseFloat(fn[4])
    const channels = [fn[1], fn[2], fn[3]].map(Number)
    if (channels.some((c) => c > 255) || alpha > 1) throw new Error(`Colour out of range: ${value}`)
    return { r: channels[0], g: channels[1], b: channels[2], a: alpha }
  }
  throw new Error(`Unresolvable colour: ${value}`)
}

/**
 * Alpha-composite `fg` over an opaque `bg` (source-over).
 *
 * @param {{ r: number, g: number, b: number, a: number }} fg
 * @param {{ r: number, g: number, b: number, a: number }} bg must be opaque
 */
export function composite(fg, bg) {
  if (bg.a !== 1) throw new Error('composite: background must be opaque')
  const mix = (f, b) => Math.round(f * fg.a + b * (1 - fg.a))
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 }
}

/** @param {{ r: number, g: number, b: number }} c */
export function toHex(c) {
  return '#' + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance(c) {
  const lin = (n) => {
    const s = n / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
}

/**
 * Contrast ratio of two colour strings. A translucent foreground is
 * composited over the background; the background must be opaque.
 *
 * @param {string} fg
 * @param {string} bg
 */
export function contrastRatio(fg, bg) {
  const b = parseColor(bg)
  const f = composite(parseColor(fg), b)
  const [hi, lo] = [relativeLuminance(f), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// ---------------------------------------------------------------------------
// Token parsing and resolution
// ---------------------------------------------------------------------------

/** @param {string} body declarations inside one block */
function parseDeclarations(body) {
  const out = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/**
 * Extract the dark (`:root`) and light (`:root[data-theme='light']`) token
 * maps. Light inherits dark tokens it does not redeclare. Throws if either
 * block is missing.
 *
 * @param {string} css
 * @returns {{ dark: Record<string, string>, light: Record<string, string> }}
 */
export function parseThemes(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const dark = /(?:^|[\s}]):root\s*\{([^}]*)\}/.exec(code)
  const light = /:root\[data-theme=['"]?light['"]?\]\s*\{([^}]*)\}/.exec(code)
  if (!dark) throw new Error('tokens.css: no :root block')
  if (!light) throw new Error("tokens.css: no :root[data-theme='light'] block")
  const darkTokens = parseDeclarations(dark[1])
  return { dark: darkTokens, light: { ...darkTokens, ...parseDeclarations(light[1]) } }
}

/**
 * Resolve a token to an opaque hex: follows `var()` references, composites a
 * translucent value over `over` (a resolved opaque hex). Throws on a missing
 * token, a cycle, or a non-colour value.
 *
 * @param {Record<string, string>} tokens
 * @param {string} name
 * @param {string} [over] opaque hex to composite translucent values over
 * @returns {string}
 */
export function resolveToken(tokens, name, over) {
  const seen = new Set()
  let value = tokens[name]
  let ref = name
  while (true) {
    if (value === undefined) throw new Error(`Unresolvable token ${name}: ${ref} is not defined`)
    const v = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value)
    if (!v) break
    if (seen.has(v[1])) throw new Error(`Unresolvable token ${name}: var() cycle at ${v[1]}`)
    seen.add(v[1])
    ref = v[1]
    value = tokens[ref]
  }
  let color
  try {
    color = parseColor(value)
  } catch {
    throw new Error(`Unresolvable token ${name}: ${value}`)
  }
  if (color.a === 1) return toHex(color)
  if (over === undefined) throw new Error(`Unresolvable token ${name}: translucent with no ground`)
  return toHex(composite(color, parseColor(over)))
}

/**
 * Measure every pair in both themes.
 *
 * @param {{ dark: Record<string, string>, light: Record<string, string> }} themes
 * @param {typeof CONTRAST_PAIRS} [pairs]
 */
export function evaluatePairs(themes, pairs = CONTRAST_PAIRS) {
  const results = []
  for (const theme of /** @type {const} */ (['dark', 'light'])) {
    const tokens = themes[theme]
    const base = resolveToken(tokens, '--bg-base')
    for (const pair of pairs) {
      const bg = resolveToken(tokens, pair.bg, base)
      const fg = resolveToken(tokens, pair.fg, bg)
      const ratio = contrastRatio(fg, bg)
      const min = MIN_RATIO[pair.kind]
      const advisory = ADVISORY_KINDS.has(pair.kind)
      results.push({ theme, ...pair, fgHex: fg, bgHex: bg, ratio, min, pass: ratio >= min, advisory })
    }
  }
  return results
}

/**
 * Same hue and saturation, lower HSL lightness, until `fg` meets `min` on
 * `bg`. Used to propose a fix for a failing semantic colour.
 *
 * @param {string} fg opaque hex
 * @param {string} bg opaque hex
 * @param {number} min
 * @returns {string | null} the lightest passing darkened hex, or null
 */
export function proposeDarkened(fg, bg, min) {
  const { h, s, l } = rgbToHsl(parseColor(fg))
  for (let next = l; next >= 0; next -= 0.005) {
    const hex = toHex(hslToRgb(h, s, next))
    if (contrastRatio(hex, bg) >= min) return hex
  }
  return null
}

function rgbToHsl({ r, g, b }) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return { h: h / 6, s, l }
}

function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  const ch = (t) => Math.round(Math.min(1, Math.max(0, hue(t))) * 255)
  return { r: ch(h + 1 / 3), g: ch(h), b: ch(h - 1 / 3), a: 1 }
}

/**
 * Enforced pairs below their minimum.
 * @param {ReturnType<typeof evaluatePairs>} results
 */
export function failingPairs(results) {
  return results.filter((r) => !r.pass && !r.advisory)
}

/** Measure the live tokens.css. */
export function checkRepo() {
  return evaluatePairs(parseThemes(readFileSync(TOKENS_PATH, 'utf8')))
}

function main() {
  const results = checkRepo()
  const rows = results.map((r) => [
    r.theme,
    r.kind,
    `${r.fg} ${r.fgHex}`,
    `${r.bg} ${r.bgHex}`,
    r.ratio.toFixed(2),
    `${r.min}`,
    r.pass ? 'PASS' : r.advisory ? 'WARN' : 'FAIL',
  ])
  const header = ['theme', 'kind', 'foreground', 'background', 'ratio', 'min', '']
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)))
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ')
  console.log(line(header))
  for (const row of rows) console.log(line(row))

  const warnings = results.filter((r) => !r.pass && r.advisory)
  if (warnings.length > 0) {
    console.log(`[contrast] WARN: ${warnings.length} advisory pair(s) below 3:1 (not enforced; see the edge kind).`)
  }
  const failures = failingPairs(results)
  if (failures.length > 0) {
    console.error(`[contrast] FAIL: ${failures.length} of ${results.length} pair(s) below minimum.`)
    for (const f of failures) {
      const fix = proposeDarkened(f.fgHex, f.bgHex, f.min)
      console.error(`  ${f.theme} ${f.fg} on ${f.bg} (${f.use}) ${f.ratio.toFixed(2)} < ${f.min}`)
      if (fix) console.error(`    same-hue value that passes: ${fix}`)
    }
    process.exit(1)
  }
  const enforced = results.filter((r) => !r.advisory).length
  console.log(`[contrast] PASS: ${enforced} enforced pair(s) across dark and light.`)
}

// CLI entry only when invoked directly, so the unit test can import the pure
// functions without triggering process.exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
