// Brand_Strings guard (GlyphCity rebrand R1.6, task 0.5).
//
// Fails when a brand string is written as a literal in a user-facing file
// instead of being read from Brand_Constants
// (`packages/shared/constants/brand.ts`). Matched literals:
//
//   - "Area Code"         (old product name; legal text reads COMPANY_NAME)
//   - "areacode.co.za"    (old app domain)
//   - "GlyphCity" / "glyphcity" / "glyphcity.com"  (APP_NAME, APP_DOMAIN)
//   - "Check the beams."  (BRAND_LINE)
//
// SPOKEN_NAME ('Glyph') is deliberately not matched: "glyph" is a common word
// in the codebase. Comments are stripped before matching; only shipped
// literals count.
//
// User-facing files are an explicit list (SCANNED_FILE_PATTERNS): i18n locale
// JSON, apps/*/index.html, manifests (PWA and Expo), the service worker,
// email templates, owner-facing copy builders, legal content and screens, and
// share builders. Tests, docs, specs and brand.ts itself are never scanned.
//
// Baseline ratchet. Phase 1 (tasks 1.2 to 1.4) replaces strings and Phase 3
// (tasks 8.x) replaces domains, so existing hits are frozen in
// `scripts/brand-strings-baseline.json` as file -> count. The guard fails on:
//
//   - a hit in a file not in the baseline                ("new")
//   - a count above its baseline count                   ("grew")
//   - a count below its baseline count, or zero          ("stale")
//
// "stale" is a failure so the baseline can only shrink: after removing
// literals, run `node scripts/check-brand-strings.mjs --shrink` to lower the
// counts. `--shrink` refuses to run while any "new" or "grew" failure exists,
// so it can never raise the baseline.
//
// The baseline MUST be empty by the end of task 8.7. Once it is empty, delete
// `scripts/brand-strings-baseline.json` (no-fallbacks-no-legacy.md); a missing
// baseline means zero tolerated hits.
//
// Usage (from the repo root):
//   node scripts/check-brand-strings.mjs           # check; non-zero exit on failure
//   node scripts/check-brand-strings.mjs --shrink  # lower stale baseline counts
//
// Wired into `pnpm test` through scripts/check-brand-strings.test.ts (live
// repo assertion) and runnable alone as `pnpm guard:brand`. The pure functions
// are exported so the unit test can exercise them against fixture strings.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

/** Committed ratchet baseline. Deleted once empty (end of task 8.7). */
export const BASELINE_PATH = join(REPO_ROOT, 'scripts', 'brand-strings-baseline.json')

/** The one home for brand values; never scanned. */
export const BRAND_CONSTANTS_PATH = 'packages/shared/constants/brand.ts'

/** Roots walked for scanned files. */
const SOURCE_ROOTS = ['apps', 'backend', 'packages']

/** Directory names never walked (mirrors the other repo scanners). */
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage', '.claude', '.expo', 'build'])

/**
 * Brand literals. Each pattern is global; the alternatives never overlap, so
 * a file's hit count is the sum of per-pattern matches.
 */
export const BRAND_PATTERNS = [/Area Code/g, /areacode\.co\.za/gi, /\bglyphcity\b(?:\.com)?/gi, /Check the beams\./g]

/**
 * The explicit user-facing file list (repo-relative, forward slashes).
 * Grouped by the R1.6 categories.
 */
export const SCANNED_FILE_PATTERNS = [
  // i18n locale JSON
  /^apps\/[^/]+\/src\/i18n\/locales\/[^/]+\.json$/,
  /^packages\/shared\/i18n\/.+\.json$/,
  // HTML shells (title, meta, Open Graph)
  /^apps\/[^/]+\/index\.html$/,
  // Manifests: PWA manifests and the Expo app config (store name)
  /^apps\/[^/]+\/public\/[^/]*manifest[^/]*\.(json|webmanifest)$/,
  /^apps\/mobile\/app\.config\.ts$/,
  // Service worker (push notification titles)
  /^apps\/[^/]+\/public\/sw\.js$/,
  // Email templates and senders
  /^backend\/src\/shared\/email\/.+\.(ts|html)$/,
  // Owner-facing email and digest copy builders
  /^backend\/src\/features\/reports\/(digest|receipt|receipt-copy)\.ts$/,
  /^backend\/src\/features\/business\/trial-reminder\.ts$/,
  /^backend\/src\/features\/campaigns\/(sender|unsubscribe)\.ts$/,
  // Push notification copy
  /^backend\/src\/features\/notifications\/service\.ts$/,
  // Legal content and the screens that render it
  /^packages\/shared\/constants\/legal(-content)?\.ts$/,
  /^apps\/web\/src\/screens\/(PrivacyPolicy|Terms)Screen\.tsx$/,
  // Share builders and the share route
  /^backend\/src\/features\/nodes\/share-(snapshot|preview|routes)\.ts$/,
  /^apps\/web\/src\/lib\/shareCard\.ts$/,
  // One-time widening (task 1.2): all app source and shared components, plus
  // the files the task 1.1 inventory flagged as unseen. Domain hits these
  // files still carried at widening were baselined once and leave in 8.x.
  /^apps\/[^/]+\/src\/.+\.(ts|tsx)$/,
  /^apps\/mobile\/app\/.+\.(ts|tsx)$/,
  /^packages\/shared\/components\/.+\.(ts|tsx)$/,
  /^packages\/shared\/lib\/imageCompression\.ts$/,
  /^backend\/src\/features\/auth\/service\.ts$/,
  /^backend\/src\/shared\/cognito\/client\.ts$/,
  /^apps\/[^/]+\/public\/robots\.txt$/,
  /^apps\/web\/public\/sitemap\.xml$/,
]

/**
 * True when a repo-relative path is a user-facing file the guard scans.
 * Tests, specs, docs and brand.ts are always excluded.
 *
 * @param {string} relPath repo-relative path with forward slashes
 * @returns {boolean}
 */
export function isScannedFile(relPath) {
  if (relPath === BRAND_CONSTANTS_PATH) return false
  if (relPath.split('/').includes('__tests__')) return false
  if (/\.(test|spec)\.[a-z]+$/.test(relPath)) return false
  if (relPath.startsWith('docs/') || relPath.startsWith('.kiro/')) return false
  return SCANNED_FILE_PATTERNS.some((pattern) => pattern.test(relPath))
}

/**
 * Remove comments so only shipped literals count. JS/TS: block and line
 * comments (sparing `://` in URLs). HTML: `<!-- -->`. JSON has none.
 *
 * @param {string} text
 * @param {string} relPath used to pick the comment syntax
 * @returns {string}
 */
export function stripComments(text, relPath) {
  if (relPath.endsWith('.html')) return text.replace(/<!--[\s\S]*?-->/g, ' ')
  if (/\.(ts|tsx|js|mjs)$/.test(relPath)) {
    const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, ' ')
    return withoutBlocks.replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }
  return text
}

/**
 * Count brand literals in a file's content (comments stripped).
 *
 * @param {string} text
 * @param {string} relPath
 * @returns {number}
 */
export function countBrandHits(text, relPath) {
  const code = stripComments(text, relPath)
  let total = 0
  for (const pattern of BRAND_PATTERNS) total += (code.match(pattern) ?? []).length
  return total
}

/**
 * The pure ratchet decision. `current` holds only files with at least one hit.
 *
 * @param {Record<string, number>} baseline file -> frozen count
 * @param {Record<string, number>} current file -> live count (> 0)
 * @returns {Array<{ path: string, kind: 'new' | 'grew' | 'stale', count: number, frozen?: number }>}
 */
export function evaluateBaseline(baseline, current) {
  const failures = []
  for (const [path, count] of Object.entries(current)) {
    if (!Object.prototype.hasOwnProperty.call(baseline, path)) {
      failures.push({ path, kind: 'new', count })
    } else if (count > baseline[path]) {
      failures.push({ path, kind: 'grew', count, frozen: baseline[path] })
    }
  }
  for (const [path, frozen] of Object.entries(baseline)) {
    const count = current[path] ?? 0
    if (count < frozen) failures.push({ path, kind: 'stale', count, frozen })
  }
  return failures.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Lower stale baseline entries to their live counts and drop zeros. Throws if
 * any failure is "new" or "grew", so the baseline can never rise.
 *
 * @param {Record<string, number>} baseline
 * @param {Record<string, number>} current
 * @returns {Record<string, number>}
 */
export function shrinkBaseline(baseline, current) {
  const growth = evaluateBaseline(baseline, current).filter((f) => f.kind !== 'stale')
  if (growth.length > 0) {
    throw new Error(`Cannot shrink: ${growth.length} new or grown hit(s). Remove the literals first.`)
  }
  const next = {}
  for (const path of Object.keys(baseline).sort()) {
    const count = current[path] ?? 0
    if (count > 0) next[path] = count
  }
  return next
}

/** @param {string} absDir @param {string[]} out repo-relative paths */
function walk(absDir, out) {
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      walk(join(absDir, entry.name), out)
    } else if (entry.isFile()) {
      const rel = relative(REPO_ROOT, join(absDir, entry.name)).split(sep).join('/')
      if (isScannedFile(rel)) out.push(rel)
    }
  }
}

/**
 * Scan the repo. Returns file -> hit count for files with at least one hit.
 * @returns {{ scanned: string[], hits: Record<string, number> }}
 */
export function scanRepo() {
  const scanned = []
  for (const root of SOURCE_ROOTS) walk(join(REPO_ROOT, root), scanned)
  scanned.sort()
  const hits = {}
  for (const rel of scanned) {
    const count = countBrandHits(readFileSync(join(REPO_ROOT, rel), 'utf8'), rel)
    if (count > 0) hits[rel] = count
  }
  return { scanned, hits }
}

/** Read the baseline. A missing file means zero tolerated hits. */
export function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return {}
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? {}
}

/** @param {Record<string, number>} files */
function writeBaseline(files) {
  const payload = {
    _comment:
      'Frozen brand-literal counts for scripts/check-brand-strings.mjs (GlyphCity R1.6). ' +
      'This list may only shrink: run `node scripts/check-brand-strings.mjs --shrink` after ' +
      'removing literals. Must be empty by the end of task 8.7, then this file is deleted.',
    files,
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n')
}

function main() {
  const baseline = readBaseline()
  const { scanned, hits } = scanRepo()

  if (process.argv.includes('--shrink')) {
    const next = shrinkBaseline(baseline, hits)
    writeBaseline(next)
    console.log(`[brand-strings] Baseline shrunk to ${Object.keys(next).length} file(s).`)
    return
  }

  const failures = evaluateBaseline(baseline, hits)
  const total = Object.values(baseline).reduce((sum, n) => sum + n, 0)
  console.log(`[brand-strings] Scanned ${scanned.length} user-facing file(s).`)

  if (failures.length > 0) {
    console.error(`[brand-strings] FAIL: ${failures.length} problem(s):`)
    for (const f of failures) {
      if (f.kind === 'new') console.error(`  NEW    ${f.path} (${f.count} brand literal(s), not baselined)`)
      else if (f.kind === 'grew') console.error(`  GREW   ${f.path} (${f.count} > baseline ${f.frozen})`)
      else console.error(`  STALE  ${f.path} (${f.count} < baseline ${f.frozen})`)
    }
    if (failures.some((f) => f.kind !== 'stale')) {
      console.error(
        '[brand-strings] Read the value from packages/shared/constants/brand.ts (or interpolate {{appName}}).',
      )
    }
    if (failures.some((f) => f.kind === 'stale')) {
      console.error('[brand-strings] Shrink the baseline: node scripts/check-brand-strings.mjs --shrink')
    }
    process.exit(1)
  }

  console.log(
    `[brand-strings] PASS: no new brand literals. Baseline: ${Object.keys(baseline).length} file(s), ${total} hit(s).`,
  )
}

// CLI entry only when invoked directly, so the unit test can import the pure
// functions without triggering a filesystem walk or process.exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
