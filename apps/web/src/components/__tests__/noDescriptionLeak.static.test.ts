/**
 * Static guard for Property 4 (glyphcity-rebrand): no consumer source reads an
 * archetype `description`. Covers surfaces the render property does not mount
 * (mobile, canvas share cards, future screens). Admin is out of scope: the
 * description is for the Glyph_Codex and internal tools.
 *
 * Flags, in non-test source under apps/web/src, apps/mobile/app and
 * apps/mobile/src (comments stripped):
 * - `<arch|archetype|glyph...>.description` on any identifier;
 * - any `description` token in a file that touches the archetype catalog
 *   (ARCHETYPE_CATALOG, archetype-catalog, PersonalityArchetype).
 *
 * Validates: Requirements 3.3, 3.4
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))
const SCAN_ROOTS = ['apps/web/src', 'apps/mobile/app', 'apps/mobile/src']

/**
 * Explicit exceptions, keyed by repo-relative path, each with a reason. Empty
 * today; add an entry only with a founder-visible reason.
 */
const ALLOWLIST: Record<string, string> = {}

const ARCHETYPE_DESCRIPTION_READ = /\b\w*(?:arch|glyph)\w*\??\.description\b/i
const CATALOG_AWARE = /ARCHETYPE_CATALOG|archetype-catalog|PersonalityArchetype/
const DESCRIPTION_TOKEN = /\bdescription\b/

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

function isTestPath(path: string): boolean {
  return path.split(sep).includes('__tests__') || /\.(test|spec)\.tsx?$/.test(path)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules') return []
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(name) && !isTestPath(full) ? [full] : []
  })
}

/** Offending lines for one file's source, empty when clean. */
function findDescriptionReads(src: string): string[] {
  const code = stripComments(src)
  const catalogAware = CATALOG_AWARE.test(code)
  return code
    .split('\n')
    .filter((line) => ARCHETYPE_DESCRIPTION_READ.test(line) || (catalogAware && DESCRIPTION_TOKEN.test(line)))
    .map((line) => line.trim())
}

describe('Feature: GlyphCity rebrand, Property 4: no description leak (static)', () => {
  it('detects archetype description reads', () => {
    expect(findDescriptionReads('const t = archetype.description')).toHaveLength(1)
    expect(findDescriptionReads('<p>{arch?.description}</p>')).toHaveLength(1)
    expect(
      findDescriptionReads("import { ARCHETYPE_CATALOG } from 'x'\nconst { description } = ARCHETYPE_CATALOG[0]"),
    ).toHaveLength(1)
    expect(findDescriptionReads('<p>{reward.description}</p>')).toHaveLength(0)
    expect(findDescriptionReads("import { ARCHETYPE_CATALOG } from 'x'\n// the description is not read")).toHaveLength(
      0,
    )
  })

  it('no consumer source reads an archetype description', () => {
    const files = SCAN_ROOTS.flatMap((root) => sourceFiles(join(REPO_ROOT, root)))
    expect(files.length).toBeGreaterThan(0)

    const offenders = files.flatMap((file) => {
      const rel = relative(REPO_ROOT, file).split(sep).join('/')
      if (rel in ALLOWLIST) return []
      return findDescriptionReads(readFileSync(file, 'utf8')).map((line) => `${rel}: ${line}`)
    })
    expect(offenders).toEqual([])
  })
})
