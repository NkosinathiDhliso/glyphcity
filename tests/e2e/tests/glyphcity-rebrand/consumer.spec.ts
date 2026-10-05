/**
 * Consumer app words and glyphs after the rebrand.
 *
 * Spec: .kiro/specs/glyphcity-rebrand, Requirements 2.3, 2.4, 3.1, 3.2, 3.4,
 * 3.5, 5.3, task 16.2 (R12.4).
 *
 * What these tests pin:
 *   1. Plain_Scale: at every NodeState the venue card and the venue detail use
 *      the plain words and never Popping, Buzzing, Active or Dormant.
 *   2. The profile shows "Your glyph", the Glyph_Name and "Share my glyph".
 *   3. No archetype description is rendered anywhere a consumer can reach.
 *   4. axe criticals are clean on AuthLanding, venue detail and profile, in
 *      light and dark.
 *
 * Data: the dev mock (`VITE_DEV_MOCK=true`, declared with `E2E_DEV_MOCK=1`).
 * It patches the API client in-process, so `page.route` cannot shape node
 * data; the mock's fixed venues cover every state instead (`MOCK_VENUES`).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../../support/fixtures.js'
import {
  GLYPHS,
  MOCK_VENUES,
  PLAIN_SCALE,
  RETIRED_STATE_WORDS,
  TARGET,
  bodyText,
  presetTheme,
  seedDevMockSession,
  type Theme,
} from '../../support/rebrand.js'
import { consumer } from '../../support/selectors.js'
import { expectAxeCriticalsClean } from '../../support/structure.js'

test.skip(!TARGET.devMock, 'Needs a dev-mock build (E2E_DEV_MOCK=1): venues at every state and a mock consumer')

type MockVenue = (typeof MOCK_VENUES)[keyof typeof MOCK_VENUES]

/** Land on `venue` as the Active_Venue in Browse_Mode through its share link. */
async function landOn(page: Page, venue: MockVenue): Promise<void> {
  await page.goto(`/node/${venue.slug}`)
  await expect(consumer.peekCarousel(page)).toBeVisible({ timeout: 30_000 })
  await expect(consumer.activeVenueCard(page)).toHaveAttribute('data-venue-card', venue.id, { timeout: 20_000 })
}

/** Browse_Mode to Commit_Mode through the one control allowed to open details. */
async function openDetails(page: Page): Promise<void> {
  await consumer.viewDetails(page).click()
  await expect(consumer.peekCarousel(page)).toHaveAttribute('data-mode', 'commit')
}

/** The detail header line: "{category word} · {State_Label}". */
const detailStateLine = (page: Page) =>
  consumer
    .peekCarousel(page)
    .locator('p', { has: page.locator('[data-category-word]') })
    .first()

/** Every description string must be absent from the visible page. */
async function expectNoDescription(page: Page, where: string): Promise<void> {
  const text = await bodyText(page)
  const leaked = GLYPHS.filter((g) => text.includes(g.description)).map((g) => g.name)
  expect(leaked, `${where}: glyph description rendered for ${leaked.join(', ')}`).toEqual([])
}

test.describe('Plain_Scale on the card and the detail (R2.3, R2.4)', () => {
  for (const [state, venue] of Object.entries(MOCK_VENUES) as Array<[keyof typeof MOCK_VENUES, MockVenue]>) {
    test(`${state}: ${venue.name} reads "${PLAIN_SCALE[state]}"`, async ({ page }) => {
      await landOn(page, venue)

      const card = consumer.activeVenueCard(page)
      // The mock pulse puts this venue in the band under test.
      await expect(card).toHaveAttribute('data-pulse-state', state)
      const cardText = `${await card.innerText()} ${(await card.getAttribute('aria-label')) ?? ''}`
      expect(cardText, 'card shows a retired State_Label').not.toMatch(RETIRED_STATE_WORDS)
      await expect(card.locator('[data-category-word]')).toHaveText(venue.category)
      if (state === 'dormant') await expect(card).toContainText(PLAIN_SCALE.dormant)

      await openDetails(page)
      await expect(detailStateLine(page)).toHaveText(`${venue.category} · ${PLAIN_SCALE[state]}`)
      const detailText = await consumer.peekCarousel(page).innerText()
      expect(detailText, 'detail shows a retired State_Label').not.toMatch(/\b(popping|buzzing|dormant)\b/i)
    })
  }
})

test.describe('Glyphs are named, never explained (R3.1, R3.2, R3.4)', () => {
  test('profile shows "Your glyph", the Glyph_Name and "Share my glyph"', async ({ page }) => {
    await seedDevMockSession(page, 'consumer')
    await page.goto('/profile')

    const card = page.locator('[data-your-glyph]')
    await expect(card).toBeVisible({ timeout: 20_000 })
    await expect(card.getByRole('heading', { name: /^your glyph$/i })).toBeVisible()
    await expect(card.getByRole('button', { name: /^share my glyph$/i })).toBeVisible()

    const cardText = await card.innerText()
    const named = GLYPHS.filter((g) => cardText.includes(g.name))
    expect(
      named.map((g) => g.name),
      'exactly one Glyph_Name on the profile card',
    ).toHaveLength(1)
    await expectNoDescription(page, 'profile')
  })

  test('no description on the selected card, the venue detail or the landing', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('img', { name: /glyphcity/i }).first()).toBeVisible({ timeout: 20_000 })
    await expectNoDescription(page, 'landing')

    await landOn(page, MOCK_VENUES.popping)
    // The selected card names the glyph (R3.1).
    const glyphName = consumer.activeVenueCard(page).locator('[data-glyph-name]')
    await expect(glyphName).toHaveCount(1)
    const name = (await glyphName.innerText()).replace(/^\s*·\s*/, '').trim()
    expect(GLYPHS.map((g) => g.name)).toContain(name)
    await expectNoDescription(page, 'browse card')

    await openDetails(page)
    await expect(consumer.peekCarousel(page).getByText(name).first()).toBeVisible()
    await expectNoDescription(page, 'venue detail')
  })
})

test.describe('axe criticals on the rebranded screens, both themes (R5.3, R12.4)', () => {
  for (const theme of ['light', 'dark'] as const satisfies readonly Theme[]) {
    test(`${theme}: AuthLanding, venue detail and profile`, async ({ page }) => {
      await presetTheme(page, theme)

      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.getByRole('img', { name: /glyphcity/i }).first()).toBeVisible({ timeout: 20_000 })
      await expectAxeCriticalsClean(page, `AuthLanding (${theme})`)

      await landOn(page, MOCK_VENUES.popping)
      await openDetails(page)
      await expect(detailStateLine(page)).toBeVisible()
      await expectAxeCriticalsClean(page, `venue detail (${theme})`)
    })

    test(`${theme}: profile`, async ({ page }) => {
      await presetTheme(page, theme)
      await seedDevMockSession(page, 'consumer')
      await page.goto('/profile')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('[data-your-glyph]')).toBeVisible({ timeout: 20_000 })
      await expectAxeCriticalsClean(page, `profile (${theme})`)
    })
  }
})
