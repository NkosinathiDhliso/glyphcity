// Guard for R5.9: the Brand_Line appears on the auth landing, share cards and
// the default OG image only, never in functional UI (buttons, labels, states).
// Any non-test source that references BRAND_LINE outside the allowlist fails.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

/** Files allowed to read BRAND_LINE (repo-relative, forward slashes). */
const ALLOWLIST = new Set([
  'apps/web/src/screens/AuthLanding.tsx',
  'apps/web/src/lib/shareCard.ts',
  'apps/web/src/lib/glyphShareCard.ts',
  'packages/shared/lib/glyphShare.ts',
  'scripts/generate-brand-assets.mjs',
])

/** The constant's home and its barrel re-export. */
const DEFINITIONS = new Set(['packages/shared/constants/brand.ts', 'packages/shared/constants/index.ts'])

/** A named import/re-export of BRAND_LINE, or a namespace read (`brand.BRAND_LINE`). Comments do not count. */
const READS_BRAND_LINE = [/\b(import|export)\s*(type\s*)?\{[^}]*\bBRAND_LINE\b[^}]*\}\s*from\b/, /\.BRAND_LINE\b/]

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/
const TEST_FILE = /\.test\.(ts|tsx)$|[\\/]__tests__[\\/]/
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo'])

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SOURCE_EXT.test(name)) out.push(full)
  }
}

function sourceRoots(): string[] {
  const apps = join(REPO_ROOT, 'apps')
  const appSrc = readdirSync(apps)
    .map((app) => join(apps, app, 'src'))
    .filter((p) => existsSync(p) && statSync(p).isDirectory())
  return [...appSrc, join(REPO_ROOT, 'packages', 'shared'), join(REPO_ROOT, 'scripts')]
}

function brandLineReaders(): string[] {
  const files: string[] = []
  for (const root of sourceRoots()) walk(root, files)
  return files
    .filter((f) => !TEST_FILE.test(f))
    .map((f) => relative(REPO_ROOT, f).split(sep).join('/'))
    .filter((rel) => !DEFINITIONS.has(rel))
    .filter((rel) => READS_BRAND_LINE.some((re) => re.test(readFileSync(join(REPO_ROOT, rel), 'utf8'))))
}

describe('Feature: glyphcity-rebrand, BRAND_LINE usage (R5.9)', () => {
  it('only allowlisted surfaces read BRAND_LINE', () => {
    const offenders = brandLineReaders().filter((rel) => !ALLOWLIST.has(rel))
    expect(offenders).toEqual([])
  })

  it('the auth landing, share cards and OG script do read it', () => {
    const readers = new Set(brandLineReaders())
    for (const required of [
      'apps/web/src/screens/AuthLanding.tsx',
      'apps/web/src/lib/shareCard.ts',
      'apps/web/src/lib/glyphShareCard.ts',
      'packages/shared/lib/glyphShare.ts',
      'scripts/generate-brand-assets.mjs',
    ]) {
      expect(readers.has(required)).toBe(true)
    }
  })
})
