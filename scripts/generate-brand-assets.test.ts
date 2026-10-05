import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { FAVICON_PATHS, ICO_SIZES, brandAssets } from './generate-brand-assets.mjs'

const REPO_ROOT = join(__dirname, '..')

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('generate-brand-assets: committed outputs (R5.8)', () => {
  it.each(brandAssets().map((a) => [a.path, a.width, a.height] as const))('%s is %ix%i', (path, width, height) => {
    const bytes = readFileSync(join(REPO_ROOT, path))
    expect(pngSize(bytes)).toEqual({ width, height })
  })

  it.each(FAVICON_PATHS)('%s holds every favicon frame', (path) => {
    const bytes = readFileSync(join(REPO_ROOT, path))
    expect(bytes.readUInt16LE(2)).toBe(1)
    expect(bytes.readUInt16LE(4)).toBe(ICO_SIZES.length)
    ICO_SIZES.forEach((size, i) => {
      const offset = bytes.readUInt32LE(6 + 16 * i + 12)
      expect(pngSize(bytes.subarray(offset))).toEqual({ width: size, height: size })
    })
  })
})
