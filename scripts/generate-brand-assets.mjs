// Brand asset renderer (GlyphCity rebrand R5.8, task 5.1).
//
// One source, every raster: renders the Logo_Mark
// (`packages/shared/assets/logo-mark.svg`) and the wordmark into the favicon,
// PWA icons, apple-touch icon, notification badge, iOS splash set, manifest
// screenshots, the default OG image and the Expo app icon. Output paths are
// the ones the apps' index.html, manifest and sw.js already reference.
//
// Inputs, each from its one home:
//   - name and line: packages/shared/constants/brand.ts (APP_NAME, BRAND_LINE)
//   - colours: the light theme block of packages/shared/tokens.css
//   - fonts: packages/shared/assets/fonts (Funnel Display 800, Funnel Sans 500, OFL)
//
// Ground: every icon is Bush ink on Lichen (the light theme ground and ink).
// One ground, not a light and a dark pair, because launchers and tabs pick
// their own surround and ink on lichen reads on both. The maskable icon keeps
// the mark inside the 80% safe-zone circle. Recorded in
// docs/decisions/glyphcity-rebrand.md, decision 11.
//
// Run: pnpm brand:assets

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Resvg } from '@resvg/resvg-js'

import { APP_NAME, BRAND_LINE } from '../packages/shared/constants/brand.ts'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED = join(REPO_ROOT, 'packages', 'shared')
const FONT_DIR = join(SHARED, 'assets', 'fonts')
const FONT_FILES = [join(FONT_DIR, 'FunnelDisplay-ExtraBold.ttf'), join(FONT_DIR, 'FunnelSans-Medium.ttf')]

/** Logo_Mark box (viewBox 0 0 24 34). */
const MARK_W = 24
const MARK_H = 34

/** Apps with their own public/ icon set. */
const PORTALS = ['web', 'business', 'staff', 'admin']

/** iOS portrait splash sizes; must match the apple-touch-startup-image links in apps/web/index.html. */
export const SPLASH_SIZES = [
  [1290, 2796],
  [1179, 2556],
  [1284, 2778],
  [1170, 2532],
  [1125, 2436],
  [1242, 2688],
  [828, 1792],
  [750, 1334],
  [2048, 2732],
  [1668, 2388],
  [1668, 2224],
  [1640, 2360],
  [1536, 2048],
]

/** Multi-resolution favicon.ico frames. */
export const ICO_SIZES = [16, 32, 48, 64, 128, 256]

/** Read a custom property from the light theme block of tokens.css. Crashes when absent. */
function lightToken(css, name) {
  const block = css.match(/:root\[data-theme='light'\]\s*\{([\s\S]*?)\}/)
  if (!block) throw new Error("tokens.css: :root[data-theme='light'] block not found")
  const value = block[1].match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!value) throw new Error(`tokens.css: ${name} not found in the light theme`)
  return value[1]
}

function loadPalette() {
  const css = readFileSync(join(SHARED, 'tokens.css'), 'utf8')
  return {
    ground: lightToken(css, '--bg-base'),
    ink: lightToken(css, '--text-primary'),
    inkSoft: lightToken(css, '--text-secondary'),
  }
}

/** Logo_Mark inner markup with currentColor bound to `colour`. */
function markBody(colour) {
  const src = readFileSync(join(SHARED, 'assets', 'logo-mark.svg'), 'utf8')
  const inner = src.match(/<svg[^>]*>([\s\S]*)<\/svg>/)
  if (!inner) throw new Error('logo-mark.svg: no <svg> root')
  return inner[1].replace(/<!--[\s\S]*?-->/g, '').replaceAll('currentColor', colour)
}

/** Logo_Mark placed with its centre at (cx, cy), `height` px tall. */
function markAt(colour, cx, cy, height) {
  const s = height / MARK_H
  const x = cx - (MARK_W * s) / 2
  const y = cy - height / 2
  return `<g transform="translate(${x} ${y}) scale(${s})">${markBody(colour)}</g>`
}

function doc(w, h, ground, body) {
  const bg = ground ? `<rect width="${w}" height="${h}" fill="${ground}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${body}</svg>`
}

/** Wordmark: APP_NAME lowercase, Funnel Display 800, tracking -0.05em. */
function wordmark(p, x, y, size, anchor) {
  const tracking = -0.05 * size
  return (
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Funnel Display" font-weight="800" ` +
    `font-size="${size}" letter-spacing="${tracking}" fill="${p.ink}">${APP_NAME.toLowerCase()}</text>`
  )
}

function brandLine(p, x, y, size, anchor) {
  return (
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Funnel Sans" font-weight="500" ` +
    `font-size="${size}" fill="${p.inkSoft}">${BRAND_LINE}</text>`
  )
}

/** Square icon: mark centred on the ground at `fraction` of the edge. */
function iconSvg(p, size, fraction) {
  return doc(size, size, p.ground, markAt(p.ink, size / 2, size / 2, size * fraction))
}

/** Splash and screenshot card: mark, wordmark, optionally the Brand_Line. */
function cardSvg(p, w, h, withLine) {
  const s = Math.min(w, h)
  const cx = w / 2
  const markH = s * 0.2
  const markCy = h / 2 - s * 0.12
  const wordY = markCy + markH / 2 + s * 0.13
  let body = markAt(p.ink, cx, markCy, markH) + wordmark(p, cx, wordY, s * 0.1, 'middle')
  if (withLine) body += brandLine(p, cx, wordY + s * 0.07, s * 0.035, 'middle')
  return doc(w, h, p.ground, body)
}

/** Default OG image, 1200x630: mark, wordmark and Brand_Line, ink on ground. */
function ogSvg(p) {
  const body = markAt(p.ink, 170, 300, 230) + wordmark(p, 300, 340, 150, 'start') + brandLine(p, 308, 420, 44, 'start')
  return doc(1200, 630, p.ground, body)
}

/** Monochrome notification badge: white mark on transparent (Android masks to silhouette). */
function badgeSvg() {
  return doc(72, 72, null, markAt('#ffffff', 36, 36, 62))
}

function render(svg) {
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Funnel Sans' },
  })
  return resvg.render().asPng()
}

/** Multi-resolution .ico with PNG-encoded frames (Vista+ format). */
export function encodeIco(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length
  frames.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, at)
    header.writeUInt8(size >= 256 ? 0 : size, at + 1)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...frames.map((f) => f.png)])
}

/** Mark height as a fraction of the icon edge. */
const ICON_FRACTION = 0.66
const FAVICON_FRACTION = 0.84
/** 0.5 keeps the mark's corners inside the 0.4-radius maskable safe circle. */
const MASKABLE_FRACTION = 0.5

/**
 * Every raster this script writes: repo-relative path, pixel size, and the
 * SVG builder. Exported so the dimension test reads the same list.
 */
export function brandAssets(p = loadPalette()) {
  const assets = []
  const add = (path, w, h, svg) => assets.push({ path, width: w, height: h, svg })
  for (const app of PORTALS) {
    const dir = `apps/${app}/public`
    add(`${dir}/apple-touch-icon.png`, 180, 180, () => iconSvg(p, 180, ICON_FRACTION))
    add(`${dir}/icon-192.png`, 192, 192, () => iconSvg(p, 192, ICON_FRACTION))
    add(`${dir}/icon-512.png`, 512, 512, () => iconSvg(p, 512, ICON_FRACTION))
  }
  const web = 'apps/web/public'
  add(`${web}/icon-512-maskable.png`, 512, 512, () => iconSvg(p, 512, MASKABLE_FRACTION))
  add(`${web}/badge-72.png`, 72, 72, () => badgeSvg())
  add(`${web}/og-image.png`, 1200, 630, () => ogSvg(p))
  for (const [w, h] of SPLASH_SIZES) {
    add(`${web}/splash/splash-${w}x${h}.png`, w, h, () => cardSvg(p, w, h, false))
  }
  add(`${web}/screenshots/narrow.png`, 1080, 1920, () => cardSvg(p, 1080, 1920, true))
  add(`${web}/screenshots/wide.png`, 1920, 1080, () => cardSvg(p, 1920, 1080, true))
  add('apps/mobile/assets/icon.png', 1024, 1024, () => iconSvg(p, 1024, ICON_FRACTION))
  return assets
}

/** favicon.ico paths, one per portal. */
export const FAVICON_PATHS = PORTALS.map((app) => `apps/${app}/public/favicon.ico`)

function write(relPath, bytes) {
  const abs = join(REPO_ROOT, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, bytes)
}

function main() {
  const palette = loadPalette()
  for (const asset of brandAssets(palette)) {
    write(asset.path, render(asset.svg()))
    console.log(`Wrote ${asset.path} (${asset.width}x${asset.height})`)
  }
  const frames = ICO_SIZES.map((size) => ({ size, png: render(iconSvg(palette, size, FAVICON_FRACTION)) }))
  const ico = encodeIco(frames)
  for (const path of FAVICON_PATHS) {
    write(path, ico)
    console.log(`Wrote ${path} (${ICO_SIZES.join(', ')})`)
  }
}

// CLI entry only when invoked directly, so the test can import the asset list.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
