// Guard for north-star-alignment R9.1: the North_Star lives once, in
// `rules/product.md`. Removing the heading or rewording either test fails here,
// so the sentence cannot drift without this spec being updated with it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

/** The `## North star` section of `rules/product.md`, up to the next heading. */
function northStarSection(): string {
  const product = readFileSync(join(REPO_ROOT, 'rules', 'product.md'), 'utf8')
  const start = product.indexOf('\n## North star\n')
  if (start === -1) return ''
  const rest = product.slice(start + 1)
  const next = rest.indexOf('\n## ', 1)
  // Rules files wrap at 80 columns; compare on single spaces.
  return (next === -1 ? rest : rest.slice(0, next)).replace(/\s+/g, ' ')
}

describe('North_Star (north-star-alignment R9.1)', () => {
  it('keeps the heading in rules/product.md', () => {
    expect(northStarSection()).not.toBe('')
  })

  it('names the one north star', () => {
    expect(northStarSection()).toContain('GlyphCity is the live map of which rooms are actually busy.')
  })

  it('keeps the Truth_Test verbatim', () => {
    expect(northStarSection()).toContain('making the map more truthful about who is in the room')
  })

  it('keeps the Arrival_Test verbatim', () => {
    expect(northStarSection()).toContain('letting a venue pay for arrivals it can verify')
  })
})
