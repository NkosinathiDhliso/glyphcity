/**
 * Brand Vite plugin (GlyphCity rebrand R1.2, R1.5). Shared by all four Vite
 * apps so the HTML shell and public templates read Brand_Constants instead
 * of literals.
 *
 * - `index.html`: the `BRAND_TOKENS` placeholders (`%APP_NAME%`, `%APP_URL%`,
 *   ...) are replaced before Vite's own `%ENV%` pass (`order: 'pre'`).
 * - `publicTemplates`: files in `public/` (the PWA manifest, the service
 *   worker, robots.txt, sitemap.xml) carrying the same placeholders. Replaced
 *   when served in dev and rewritten in the build output.
 *
 * A placeholder that is not a known brand token fails the build.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

import { APP_DOMAIN, APP_NAME, APP_URL, BUSINESS_URL, SPOKEN_NAME, SUPPORT_EMAIL } from '../constants/brand'
import { THEME_GROUND } from '../constants/theme-ground'

export const BRAND_TOKENS: Readonly<Record<string, string>> = {
  APP_NAME,
  SPOKEN_NAME,
  APP_DOMAIN,
  APP_URL,
  APP_BUSINESS_URL: BUSINESS_URL,
  APP_SUPPORT_EMAIL: SUPPORT_EMAIL,
  // theme-color meta, manifest colours and the pre-hydration backstop.
  APP_THEME_DARK: THEME_GROUND.dark,
  APP_THEME_LIGHT: THEME_GROUND.light,
}

const KNOWN_TOKEN = new RegExp(`%(${Object.keys(BRAND_TOKENS).join('|')})%`, 'g')
const ANY_BRAND_LIKE_TOKEN = /%(?:APP|SPOKEN)_[A-Z_]+%/

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
}

/** Replace brand placeholders. Throws on an unknown `%APP_*%` token. */
export function applyBrandTokens(text: string, source = 'template'): string {
  const out = text.replace(KNOWN_TOKEN, (_match, key: string) => BRAND_TOKENS[key] as string)
  const leftover = ANY_BRAND_LIKE_TOKEN.exec(out)
  if (leftover) throw new Error(`[brand] Unknown brand placeholder ${leftover[0]} in ${source}`)
  return out
}

interface DevRequest {
  url?: string | undefined
}
interface DevResponse {
  setHeader(name: string, value: string): unknown
  end(body: string): unknown
}
interface DevServer {
  config: { publicDir: string }
  middlewares: { use(handler: (req: DevRequest, res: DevResponse, next: () => void) => void): unknown }
}

export interface BrandPluginOptions {
  /** File names inside `public/` that carry brand placeholders. */
  publicTemplates?: readonly string[]
}

export function brandPlugin(options: BrandPluginOptions = {}) {
  const templates = options.publicTemplates ?? []
  return {
    name: 'area-code-brand',
    transformIndexHtml: {
      order: 'pre' as const,
      handler: (html: string) => applyBrandTokens(html, 'index.html'),
    },
    configureServer(server: DevServer) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? ''
        if (!templates.includes(name)) return next()
        const raw = readFileSync(join(server.config.publicDir, name), 'utf8')
        res.setHeader('Content-Type', CONTENT_TYPES[extname(name)] ?? 'text/plain')
        res.end(applyBrandTokens(raw, name))
      })
    },
    writeBundle(output: { dir?: string | undefined }) {
      if (templates.length === 0) return
      if (!output.dir) throw new Error('[brand] Build output dir is not set')
      for (const name of templates) {
        const path = join(output.dir, name)
        if (!existsSync(path)) throw new Error(`[brand] Public template ${name} missing from build output`)
        writeFileSync(path, applyBrandTokens(readFileSync(path, 'utf8'), name))
      }
    },
  }
}
