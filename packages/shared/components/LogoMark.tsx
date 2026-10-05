import { useId } from 'react'

// One source: the same SVG file the raster script reads
// (scripts/generate-brand-assets.mjs). Vite inlines it at build time.
import logoMarkSource from '../assets/logo-mark.svg?raw'

const GRADIENT_ID = 'logo-mark-beam'

function parseLogoMark(src: string): { viewBox: string; body: string } {
  const root = src.match(/<svg([^>]*)>([\s\S]*)<\/svg>/)
  const viewBox = root?.[1]?.match(/viewBox="([^"]+)"/)?.[1]
  if (!root?.[2] || !viewBox) throw new Error('logo-mark.svg: no <svg> root with a viewBox')
  return { viewBox, body: root[2].replace(/<!--[\s\S]*?-->/g, '').trim() }
}

const LOGO_MARK = parseLogoMark(logoMarkSource)
const [, , VB_WIDTH = 24, VB_HEIGHT = 34] = LOGO_MARK.viewBox.split(/\s+/).map(Number)

interface LogoMarkProps {
  /** Rendered width in px; height follows the 24 by 34 box. */
  size: number
  className?: string
}

/**
 * The Logo_Mark (glyphcity-rebrand R5.8): a flat cone node in `currentColor`.
 * Decorative: the host control carries the accessible name. The gradient id
 * is made unique per instance so several marks on one page never collide.
 */
export function LogoMark({ size, className }: LogoMarkProps) {
  const uid = `logo-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const body = LOGO_MARK.body.replaceAll(GRADIENT_ID, uid)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={LOGO_MARK.viewBox}
      width={size}
      height={(size * VB_HEIGHT) / VB_WIDTH}
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-testid="logo-mark"
      className={className}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
