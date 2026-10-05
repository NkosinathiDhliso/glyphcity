// Muted_Labels guard (GlyphCity rebrand R5.3, task 7.2).
//
// `--text-muted` clears only the 3:1 `label` floor in check-contrast.mjs, so
// it may colour text only on labels: uppercase, mono, 11px or larger. Body,
// helper and empty-state text uses `--text-secondary` (4.5:1).
//
// Scope: `.tsx` under apps/*/src and packages/shared/components (tests
// excluded). The TypeScript parser finds every string literal and template
// part that contains `var(--text-muted)` and ties it to its JSX element:
//
//   - `text-[var(--text-muted)]` in a className needs `uppercase`,
//     `font-mono` and a size of 11px or more in the same class string
//     (`text-[11px]`+, `text-xs`, `text-sm` and up; never a smaller size at
//     any breakpoint).
//   - `placeholder:` is checked like any text (SC 1.4.3 covers placeholders).
//   - `disabled:` variants are exempt (SC 1.4.3 excludes inactive controls).
//   - Non-text utilities (`border-`, `bg-`, `ring-`, ...) and non-text style
//     properties (`background`, `borderColor`, ...) are ignored: muted meets
//     the 3:1 non-text floor (SC 1.4.11).
//   - Icons are non-text: a `lucide-react` component, a name in
//     ICON_COMPONENT_NAMES, or an `svg` with `aria-hidden`.
//   - Anything that cannot be evaluated statically (a class built in a
//     variable or a call, a colour returned from a function, a style colour
//     on a non-icon) is flagged, so it gets fixed or allowlisted with a reason.
//
// Baseline ratchet (same contract as check-brand-strings.mjs): files frozen
// in `scripts/muted-labels-baseline.json` as file -> count; fails on "new",
// "grew" and "stale". Lower counts with `--shrink`. Delete the baseline file
// once it is empty; a missing baseline means zero tolerated hits.
//
// Usage (from the repo root):
//   node scripts/check-muted-labels.mjs           # check; non-zero exit on failure
//   node scripts/check-muted-labels.mjs --list    # print every violation
//   node scripts/check-muted-labels.mjs --shrink  # lower stale baseline counts
//
// Wired into `pnpm test` through scripts/check-muted-labels.test.ts and
// runnable alone as `pnpm guard:muted`.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

import { evaluateBaseline, shrinkBaseline } from './check-brand-strings.mjs'

export { evaluateBaseline, shrinkBaseline }

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

export const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'muted-labels-baseline.json')

const MUTED = 'var(--text-muted'
const MUTED_TEXT_CLASS = 'text-[var(--text-muted)]'

const IGNORED_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage', '.claude', '.expo', 'build', '__tests__'])

/** Variants that mark an inactive control (exempt under SC 1.4.3). */
const DISABLED_VARIANTS = new Set(['disabled', 'group-disabled', 'peer-disabled', 'aria-disabled'])

/** Style properties that paint non-text surfaces (3:1 under SC 1.4.11). */
const NON_TEXT_STYLE_PROPS = new Set([
  'background',
  'backgroundColor',
  'border',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'outlineColor',
  'boxShadow',
])

/** Icon components that are not imported from lucide-react by name. */
export const ICON_COMPONENT_NAMES = new Set([
  'IconComponent', // EmptyState: a LucideIcon passed in as a prop
])

/**
 * Sites the parser cannot prove are labels or icons, each with a reason.
 * `contains` must appear on the flagged source line.
 * @type {Array<{ path: string, contains: string, reason: string }>}
 */
export const ALLOWLIST = []

const SVG_SHAPES = new Set(['svg'])

/** @param {string} relPath */
export function isScannedFile(relPath) {
  if (!relPath.endsWith('.tsx')) return false
  if (relPath.split('/').includes('__tests__')) return false
  if (/\.(test|spec)\.tsx$/.test(relPath)) return false
  return /^apps\/[^/]+\/src\//.test(relPath) || relPath.startsWith('packages/shared/components/')
}

/** Pixel size of a Tailwind font-size utility, or null if it is not one. */
export function fontSizePx(utility) {
  const named = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 }
  const m = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/.exec(utility)
  if (m) return named[m[1]] ?? 20
  const px = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(utility)
  if (px) return Number(px[1])
  const rem = /^text-\[(\d+(?:\.\d+)?)rem\]$/.exec(utility)
  if (rem) return Number(rem[1]) * 16
  return null
}

/** Split `a:b:util` into variants and utility (arbitrary values hold no colons here). */
function splitVariants(token) {
  const parts = token.split(':')
  return { variants: parts.slice(0, -1), utility: parts[parts.length - 1] }
}

/**
 * True when a class set marks a label: uppercase, font-mono, and every
 * font-size utility (any breakpoint) at 11px or more, with at least one.
 * @param {string[]} tokens
 */
export function isLabelClassSet(tokens) {
  const set = new Set(tokens)
  if (!set.has('uppercase') || !set.has('font-mono')) return false
  const sizes = tokens.map((t) => fontSizePx(splitVariants(t).utility)).filter((n) => n !== null)
  return sizes.length > 0 && sizes.every((n) => n >= 11)
}

/**
 * Classify one whitespace token that contains the muted variable.
 * @returns {'text' | 'exempt' | 'nontext' | 'raw'}
 */
export function classifyToken(token) {
  if (token.startsWith(MUTED)) return 'raw'
  const { variants, utility } = splitVariants(token)
  if (!utility.startsWith(MUTED_TEXT_CLASS)) return 'nontext'
  if (variants.some((v) => DISABLED_VARIANTS.has(v))) return 'exempt'
  return 'text'
}

function isTextLiteral(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TemplateHead ||
    node.kind === ts.SyntaxKind.TemplateMiddle ||
    node.kind === ts.SyntaxKind.TemplateTail
  )
}

function lucideImports(sf) {
  const names = new Set()
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || stmt.moduleSpecifier.text !== 'lucide-react') continue
    const bindings = stmt.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) names.add(el.name.text)
  }
  return names
}

function attrsOf(element) {
  return element.attributes.properties.filter(ts.isJsxAttribute)
}

function attrName(attr) {
  return attr.name.getText()
}

/** True when an element is an icon (non-text under SC 1.4.11). */
function isIconElement(element, lucide) {
  const tag = element.tagName.getText()
  const base = tag.split('.').pop()
  if (lucide.has(tag) || ICON_COMPONENT_NAMES.has(tag) || ICON_COMPONENT_NAMES.has(base)) return true
  if (!SVG_SHAPES.has(tag)) return false
  return attrsOf(element).some((a) => {
    if (attrName(a) !== 'aria-hidden') return false
    const init = a.initializer
    if (!init) return true
    if (ts.isStringLiteral(init)) return init.text === 'true'
    return init.expression?.kind === ts.SyntaxKind.TrueKeyword
  })
}

/** Static text of every template part between a literal and its attribute. */
function collectStatic(node, out) {
  if (ts.isTemplateExpression(node)) {
    out.push(node.head.text)
    for (const span of node.templateSpans) out.push(span.literal.text)
  }
}

const PASS_THROUGH = new Set([
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.TemplateSpan,
  ts.SyntaxKind.TemplateExpression,
  ts.SyntaxKind.JsxExpression,
])

function isLogical(node) {
  if (!ts.isBinaryExpression(node)) return false
  const op = node.operatorToken.kind
  return (
    op === ts.SyntaxKind.AmpersandAmpersandToken ||
    op === ts.SyntaxKind.BarBarToken ||
    op === ts.SyntaxKind.QuestionQuestionToken
  )
}

/**
 * Walk from a literal up through expression wrappers. Returns the first
 * ancestor that is not a wrapper, plus the static template text collected.
 */
function climb(lit) {
  const statics = []
  let node = lit.kind === ts.SyntaxKind.StringLiteral || ts.isNoSubstitutionTemplateLiteral(lit) ? lit : lit.parent
  if (node !== lit && ts.isTemplateSpan(node)) node = node.parent
  if (ts.isTemplateExpression(node)) collectStatic(node, statics)
  let child = node
  let parent = node.parent
  while (parent && (PASS_THROUGH.has(parent.kind) || isLogical(parent))) {
    collectStatic(parent, statics)
    child = parent
    parent = parent.parent
  }
  return { owner: parent, child, statics }
}

function elementOfAttribute(attr) {
  return attr.parent.parent
}

/**
 * Find muted-tone violations in one file's source.
 * @param {string} text
 * @param {string} relPath
 * @returns {Array<{ line: number, kind: string, snippet: string, start: number, end: number }>}
 */
export function findViolations(text, relPath) {
  if (!text.includes(MUTED)) return []
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lucide = lucideImports(sf)
  const out = []

  const report = (lit, kind) => {
    const { line } = sf.getLineAndCharacterOfPosition(lit.getStart(sf))
    const snippet = text.split('\n')[line].trim()
    const allowed = ALLOWLIST.some((a) => a.path === relPath && snippet.includes(a.contains))
    if (!allowed) out.push({ line: line + 1, kind, snippet, start: lit.getStart(sf), end: lit.getEnd() })
  }

  const analyse = (lit) => {
    const kinds = lit.text
      .split(/\s+/)
      .filter((t) => t.includes(MUTED))
      .map(classifyToken)
    if (kinds.every((k) => k === 'nontext' || k === 'exempt')) return
    const { owner, statics } = climb(lit)

    if (kinds.includes('raw')) {
      if (owner && ts.isPropertyAssignment(owner) && NON_TEXT_STYLE_PROPS.has(owner.name.getText())) return
      let attr = owner && ts.isJsxAttribute(owner) ? owner : null
      if (!attr && owner && ts.isPropertyAssignment(owner)) {
        const obj = owner.parent
        const expr = obj?.parent
        if (expr && ts.isJsxExpression(expr) && expr.parent && ts.isJsxAttribute(expr.parent)) attr = expr.parent
      }
      if (!attr) return report(lit, 'unresolved colour (not tied to an element)')
      if (isIconElement(elementOfAttribute(attr), lucide)) return
      return report(lit, `muted text colour via ${attrName(attr)} on a non-icon element`)
    }

    if (!owner || !ts.isJsxAttribute(owner) || attrName(owner) !== 'className') {
      return report(lit, 'dynamic class string (cannot evaluate statically)')
    }
    const element = elementOfAttribute(owner)
    if (isIconElement(element, lucide)) return
    const tokens = [lit.text, ...statics].join(' ').split(/\s+/).filter(Boolean)
    if (!isLabelClassSet(tokens)) report(lit, 'muted text on a non-label (needs uppercase font-mono >= 11px)')
  }

  const visit = (node) => {
    if (isTextLiteral(node) && node.text.includes(MUTED)) analyse(node)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function walk(absDir, out) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(join(absDir, entry.name), out)
    } else if (entry.isFile()) {
      const rel = relative(REPO_ROOT, join(absDir, entry.name)).split(sep).join('/')
      if (isScannedFile(rel)) out.push(rel)
    }
  }
}

/** @returns {{ scanned: string[], violations: Record<string, ReturnType<typeof findViolations>> }} */
export function scanRepo() {
  const scanned = []
  walk(join(REPO_ROOT, 'apps'), scanned)
  walk(join(REPO_ROOT, 'packages', 'shared', 'components'), scanned)
  scanned.sort()
  const violations = {}
  for (const rel of scanned) {
    const found = findViolations(readFileSync(join(REPO_ROOT, rel), 'utf8'), rel)
    if (found.length > 0) violations[rel] = found
  }
  return { scanned, violations }
}

/** @param {Record<string, unknown[]>} violations */
export function countsOf(violations) {
  return Object.fromEntries(Object.entries(violations).map(([p, v]) => [p, v.length]))
}

export function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return {}
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? {}
}

function writeBaseline(files) {
  const payload = {
    _comment:
      'Frozen muted-tone violation counts for scripts/check-muted-labels.mjs (GlyphCity R5.3). ' +
      'Staff, admin and the Point_Mode card were deferred in task 7.2. This list may only shrink: run `node scripts/check-muted-labels.mjs --shrink` after ' +
      'fixing sites. Delete this file once it is empty.',
    files,
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n')
}

function main() {
  const baseline = readBaseline()
  const { scanned, violations } = scanRepo()
  const counts = countsOf(violations)

  if (process.argv.includes('--list')) {
    for (const [path, list] of Object.entries(violations)) {
      for (const v of list) console.log(`${path}:${v.line}  ${v.kind}\n    ${v.snippet}`)
    }
  }

  if (process.argv.includes('--shrink')) {
    const next = shrinkBaseline(baseline, counts)
    writeBaseline(next)
    console.log(`[muted-labels] Baseline shrunk to ${Object.keys(next).length} file(s).`)
    return
  }

  const failures = evaluateBaseline(baseline, counts)
  const total = Object.values(baseline).reduce((sum, n) => sum + n, 0)
  console.log(`[muted-labels] Scanned ${scanned.length} component file(s).`)

  if (failures.length > 0) {
    console.error(`[muted-labels] FAIL: ${failures.length} problem(s):`)
    for (const f of failures) {
      if (f.kind === 'stale') {
        console.error(`  STALE  ${f.path} (${f.count} < baseline ${f.frozen})`)
        continue
      }
      const label = f.kind === 'new' ? 'NEW   ' : 'GREW  '
      console.error(`  ${label} ${f.path} (${f.count}${f.frozen === undefined ? '' : ` > baseline ${f.frozen}`})`)
      for (const v of violations[f.path] ?? []) console.error(`         :${v.line} ${v.kind}`)
    }
    if (failures.some((f) => f.kind !== 'stale')) {
      console.error(
        '[muted-labels] Use text-[var(--text-secondary)] for body text, or make it a label ' +
          '(uppercase font-mono, 11px or larger).',
      )
    }
    if (failures.some((f) => f.kind === 'stale')) {
      console.error('[muted-labels] Shrink the baseline: node scripts/check-muted-labels.mjs --shrink')
    }
    process.exit(1)
  }

  console.log(
    `[muted-labels] PASS: muted tone on labels only. Baseline: ${Object.keys(baseline).length} file(s), ${total} site(s).`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
