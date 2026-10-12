/**
 * Vibe order toggle: the Order_Control on the Browse_Mode strip.
 *
 * Spec: .kiro/specs/vibe-order-toggle (R2, R5.5)
 *
 * The control flips between "Busiest" and "My crowd". Choosing re-ranks the
 * strip in place: the Active_Venue, the browse scope and the carousel mode
 * stay as they were. A logged-out choice lives in the persisted user store, so
 * it survives a reload.
 *
 * The camera itself is not exposed to the page, so "the camera does not move"
 * is checked through what a camera move would change: the Active_Venue (the
 * selection fly-to) and the browse scope (a user pan flips it to `area`). The
 * jsdom component test asserts no camera call directly.
 *
 * Logged out, every venue has a taste score of 0, so both modes give the same
 * order; the order itself is asserted by the property tests, not here.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../../support/fixtures.js'
import { consumer } from '../../support/selectors.js'

const orderControl = (page: Page) => page.getByRole('group', { name: 'Order venues by' })
const option = (page: Page, name: 'Busiest' | 'My crowd') => orderControl(page).getByRole('button', { name })

async function openStrip(page: Page): Promise<void> {
  await page.goto(process.env['E2E_CONSUMER_URL'] ?? '/')
  await expect(consumer.map(page)).toBeVisible({ timeout: 20_000 })
  const carousel = consumer.peekCarousel(page)
  if (!(await carousel.isVisible({ timeout: 15_000 }).catch(() => false))) {
    test.skip(true, 'Peek-Carousel not visible: no nodes seeded in view')
  }
  if (
    !(await orderControl(page)
      .isVisible({ timeout: 5_000 })
      .catch(() => false))
  ) {
    test.skip(true, 'Browse_Mode strip has no cards in view')
  }
}

test.describe('Consumer: order toggle on the Browse_Mode strip', () => {
  test('toggles in place without moving the selection, scope or mode', async ({ page }) => {
    await openStrip(page)
    const carousel = consumer.peekCarousel(page)
    const activeBefore = await consumer.activeVenueCard(page).getAttribute('data-venue-card')
    const areaBefore = await page.locator('[data-back-to-recommended]').count()

    await option(page, 'My crowd').click()

    await expect(option(page, 'My crowd')).toHaveAttribute('aria-pressed', 'true')
    await expect(option(page, 'Busiest')).toHaveAttribute('aria-pressed', 'false')
    await expect(carousel).toHaveAttribute('data-mode', 'browse')
    await expect(consumer.activeVenueCard(page)).toHaveAttribute('data-venue-card', activeBefore ?? '')
    await expect(page.locator('[data-back-to-recommended]')).toHaveCount(areaBefore)
  })

  test('meets the touch target on both options', async ({ page }) => {
    await openStrip(page)

    for (const name of ['Busiest', 'My crowd'] as const) {
      const box = await option(page, name).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })

  test('keeps a logged-out choice across a reload', async ({ page }) => {
    await openStrip(page)
    await option(page, 'My crowd').click()
    await expect(option(page, 'My crowd')).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await openStrip(page)

    await expect(option(page, 'My crowd')).toHaveAttribute('aria-pressed', 'true')
  })
})
