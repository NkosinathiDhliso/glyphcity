/**
 * GlyphCity brand on all four portals, and sign-in on the glyphcity.com hosts.
 *
 * Spec: .kiro/specs/glyphcity-rebrand, Requirements 1.2, 1.4, 5.7, 7.1, 7.2,
 * task 16.2 (R12.4).
 *
 * Structural checks only: the document title, the wordmark's accessible name,
 * and the absence of "Area Code" in visible text outside the legal pages. The
 * signed-in shells need the dev mock (`E2E_DEV_MOCK=1`); the glyphcity.com
 * sign-in checks need the domain cutover (`E2E_LIVE_DOMAINS=1`).
 */

import type { Page } from '@playwright/test'

import { optional, URLS } from '../../support/env.js'
import { expect, test } from '../../support/fixtures.js'
import { BRAND, COMPANY_LITERAL, TARGET, bodyText, seedDevMockSession } from '../../support/rebrand.js'

type Portal = 'consumer' | 'business' | 'staff' | 'admin'

const PORTAL_URL: Record<Portal, () => string> = {
  consumer: URLS.consumer,
  business: URLS.business,
  staff: URLS.staff,
  admin: URLS.admin,
}

/** The wordmark: `role="img"` named with APP_NAME (packages/shared/components/Wordmark.tsx). */
const wordmark = (page: Page) => page.getByRole('img', { name: BRAND.appName, exact: true }).first()

/** Any role=img that reads as the brand must be named exactly APP_NAME. */
async function expectBrandImagesNamedCorrectly(page: Page): Promise<void> {
  const names = await page
    .getByRole('img')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? '').filter((n) => /glyph\s*city/i.test(n)))
  for (const name of names) expect(name).toBe(BRAND.appName)
}

async function expectNoCompanyName(page: Page, where: string): Promise<void> {
  const text = await bodyText(page)
  const hit = COMPANY_LITERAL.exec(text)
  expect(hit, `${where}: "${hit?.[0]}" in visible text outside legal pages`).toBeNull()
}

test.describe('GlyphCity brand on every portal (R1.2, R1.4, R5.7)', () => {
  for (const portal of ['consumer', 'business', 'staff', 'admin'] as const) {
    test(`${portal}: entry screen carries the brand`, async ({ page }) => {
      await page.goto(PORTAL_URL[portal]())
      if (portal === 'consumer') {
        // Logged-out root is the AuthLanding, which carries the wordmark.
        await expect(wordmark(page)).toBeVisible({ timeout: 20_000 })
      } else {
        await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({ timeout: 20_000 })
      }

      await expect(page).toHaveTitle(new RegExp(BRAND.appName))
      await expectBrandImagesNamedCorrectly(page)
      await expectNoCompanyName(page, `${portal} entry`)
    })

    test(`${portal}: signed-in shell carries the brand`, async ({ page }) => {
      test.skip(!TARGET.devMock, 'Needs a dev-mock build (E2E_DEV_MOCK=1) for a signed-in shell without real accounts')

      await seedDevMockSession(page, portal)
      if (portal === 'consumer') {
        // The consumer shell has no wordmark (the Map tab uses the Logo_Mark);
        // check the two primary signed-in screens for stray company names.
        await page.goto(`${PORTAL_URL.consumer()}/map`)
        await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible({ timeout: 20_000 })
        await expect(page).toHaveTitle(new RegExp(BRAND.appName))
        await expectNoCompanyName(page, 'consumer map')
        await page.goto(`${PORTAL_URL.consumer()}/profile`)
        await expect(page.locator('[data-your-glyph]')).toBeVisible({ timeout: 20_000 })
        await expectNoCompanyName(page, 'consumer profile')
        return
      }

      await page.goto(PORTAL_URL[portal]())
      await expect(wordmark(page)).toBeVisible({ timeout: 20_000 })
      await expect(page).toHaveTitle(new RegExp(BRAND.appName))
      await expectBrandImagesNamedCorrectly(page)
      await expectNoCompanyName(page, `${portal} shell`)
    })
  }

  test('legal pages name the operating company (R1.3)', async ({ page }) => {
    await page.goto(`${PORTAL_URL.consumer()}/legal/terms`)
    await expect(page.getByText(BRAND.companyName).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(BRAND.appName).first()).toBeVisible()
  })
})

/** Production hosts after the domain cutover (R7.1). */
const LIVE_HOST: Record<Portal, string> = {
  consumer: 'https://glyphcity.com',
  business: 'https://business.glyphcity.com',
  staff: 'https://staff.glyphcity.com',
  admin: 'https://admin.glyphcity.com',
}

/** Where each portal's Google button lives. */
const LOGIN_PATH: Record<Portal, string> = { consumer: '/login', business: '/', staff: '/', admin: '/' }

test.describe('Sign-in on the glyphcity.com hosts (R7.1, R7.2)', () => {
  test.skip(
    !TARGET.liveDomains,
    'glyphcity.com is not live yet (domain cutover, task 8.8). Set E2E_LIVE_DOMAINS=1 once it is.',
  )

  for (const portal of ['consumer', 'business', 'staff', 'admin'] as const) {
    test(`${portal}: sign-in loads on its glyphcity.com host and Google targets the Hosted UI`, async ({ page }) => {
      const origin = LIVE_HOST[portal]
      await page.goto(`${origin}${LOGIN_PATH[portal]}`)
      expect(new URL(page.url()).origin, 'no redirect off the glyphcity.com host').toBe(origin)
      await expect(page).toHaveTitle(new RegExp(BRAND.appName))

      // Capture the Hosted UI hop and stop it there: Google itself is never hit.
      let authorizeUrl: URL | null = null
      await page.route('**/oauth2/authorize**', async (route) => {
        authorizeUrl = new URL(route.request().url())
        await route.abort()
      })
      await page.getByRole('button', { name: /continue with google/i }).click()
      await expect.poll(() => authorizeUrl?.href ?? null, { timeout: 15_000 }).not.toBeNull()

      const url = authorizeUrl as unknown as URL
      const expectedDomain = optional(`E2E_COGNITO_DOMAIN_${portal.toUpperCase()}`, '')
      if (expectedDomain) expect(url.host).toBe(expectedDomain)
      else expect(url.host).toMatch(/\.auth\.[a-z0-9-]+\.amazoncognito\.com$/)
      expect(url.searchParams.get('identity_provider')).toBe('Google')
      // The callback comes back to the same glyphcity.com host.
      expect(new URL(url.searchParams.get('redirect_uri') ?? '').origin).toBe(origin)
    })
  }
})
