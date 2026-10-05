/**
 * Point_Mode camera view with mocked sensors.
 *
 * Spec: .kiro/specs/glyphcity-rebrand, Requirements 8.1, 8.2, 8.4, 8.6 to
 * 8.9, task 16.2 (R12.4).
 *
 * Camera, geolocation and compass are replaced before boot (`mockSensors`):
 * no real camera opens and no fix leaves the browser. The target must be built
 * with `VITE_FLAG_POINT_MODE=true` (declared with `E2E_POINT_MODE=1`), because
 * `featureGating.ts` has no runtime override, and with the dev mock for its
 * fixed venues.
 *
 * Street fixture: standing south of Kitchener's Bar and Neighbourgoods Market
 * (mock-node-3 and mock-node-4, about 130 m and 175 m away), facing roughly
 * north, both inside the 60 degree field of view and the 250 m radius.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../../support/fixtures.js'
import {
  BRAND,
  MOCK_VENUES,
  PLAIN_SCALE,
  RETIRED_STATE_WORDS,
  TARGET,
  mockSensors,
  presetTheme,
  type SensorMock,
  type Theme,
} from '../../support/rebrand.js'
import { expectAxeCriticalsClean } from '../../support/structure.js'

test.skip(
  !TARGET.pointMode || !TARGET.devMock,
  'Needs a dev-mock build with VITE_FLAG_POINT_MODE=true (declare with E2E_DEV_MOCK=1 and E2E_POINT_MODE=1)',
)

const ON_THE_STREET = { lat: -26.194, lng: 28.034, accuracy: 8 }
const FACING_NORTH = { deg: 10, accuracy: 10 }
const NEIGHBOURGOODS = { id: 'mock-node-4', name: 'Neighbourgoods Market' }

const cameraControl = (page: Page) => page.getByRole('button', { name: /point your camera at a street/i })
/** The full-screen Point_Mode layer: the only fixed overlay that hosts a <video>. */
const pointMode = (page: Page) => page.locator('div.fixed.inset-0', { has: page.locator('video') })
const fallback = (page: Page) => pointMode(page).getByRole('status')

async function openPointMode(page: Page, mock: SensorMock): Promise<void> {
  await mockSensors(page, mock)
  await page.goto('/map')
  // No permission is asked on map load (R8.8): the camera opens only from the tap.
  await expect(cameraControl(page)).toBeVisible({ timeout: 30_000 })
  await expect(pointMode(page)).toHaveCount(0)
  await cameraControl(page).click()
  await expect(pointMode(page)).toBeVisible()
}

/** Every fallback offers a way back, and taking it returns to the map. */
async function expectRouteBackToMap(page: Page): Promise<void> {
  const back = fallback(page).getByRole('button', { name: /^back to map$/i })
  await expect(back).toBeVisible()
  await back.click()
  await expect(pointMode(page)).toHaveCount(0)
  await expect(cameraControl(page)).toBeVisible()
}

test.describe('Point_Mode places beams from GPS and compass (R8.1, R8.2, R8.4, R8.7)', () => {
  test('beams render for the venues in view, and the card says the camera stays on the phone', async ({ page }) => {
    const venue = MOCK_VENUES.popping
    await openPointMode(page, { camera: 'grant', geo: ON_THE_STREET, heading: FACING_NORTH })
    const view = pointMode(page)

    // Cone_Nodes from the map's own marker builder, one per venue in frame.
    for (const id of [venue.id, NEIGHBOURGOODS.id]) {
      await expect(view.locator(`.node-marker[data-node-id="${id}"]`)).toHaveCount(1, { timeout: 15_000 })
    }
    // The same venues as a text list for screen readers (R8.9).
    const list = view.getByRole('list', { name: /venues in view/i })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list).toContainText(venue.name)
    await expect(list).toContainText(NEIGHBOURGOODS.name)

    // Labels carry "N here" or the invite, never a retired word.
    const label = view.getByRole('button', { name: new RegExp(`^${venue.name}\\s?(\\d+ here now|Be the first in)$`) })
    await expect(label).toBeVisible()
    await label.click()

    const card = view.getByRole('region', { name: /selected venue/i })
    await expect(card).toBeVisible()
    await expect(card).toContainText(PLAIN_SCALE.popping)
    await expect(card).toContainText(venue.category)
    await expect(card).toContainText('Camera stays on your phone')
    await expect(card.getByRole('button', { name: /^check in$/i })).toBeVisible()
    await expect(card.getByRole('button', { name: /^share$/i })).toBeVisible()
    expect(await card.innerText()).not.toMatch(RETIRED_STATE_WORDS)

    // Closing returns to the map.
    await view.getByRole('button', { name: /^back to map$/i }).click()
    await expect(pointMode(page)).toHaveCount(0)
  })
})

test.describe('Point_Mode fallbacks, each with a way back to the map (R8.6, R8.8)', () => {
  const cases: Array<{ title: string; mock: SensorMock; copy: string }> = [
    {
      title: 'camera denied',
      mock: { camera: 'deny', geo: ON_THE_STREET, heading: FACING_NORTH },
      copy: `Camera is off for ${BRAND.appName}`,
    },
    {
      title: 'location denied',
      mock: { camera: 'grant', geo: 'deny', heading: FACING_NORTH },
      copy: 'Location is off, so beams cannot be placed',
    },
    {
      title: 'poor GPS accuracy',
      mock: { camera: 'grant', geo: { ...ON_THE_STREET, accuracy: 80 }, heading: FACING_NORTH },
      copy: 'Point mode needs a clearer signal',
    },
    {
      title: 'no venues within the radius',
      // Open veld south-west of the city: every mock venue is kilometres away.
      mock: { camera: 'grant', geo: { lat: -26.3, lng: 27.9, accuracy: 8 }, heading: FACING_NORTH },
      copy: 'Nothing live on this street',
    },
  ]

  for (const { title, mock, copy } of cases) {
    test(title, async ({ page }) => {
      await openPointMode(page, mock)
      await expect(fallback(page)).toContainText(copy, { timeout: 15_000 })
      // No beams are placed in a fallback state.
      await expect(pointMode(page).locator('.node-marker')).toHaveCount(0)
      await expectRouteBackToMap(page)
    })
  }
})

test.describe('axe criticals on Point_Mode, both themes (R8.9, R12.4)', () => {
  for (const theme of ['light', 'dark'] as const satisfies readonly Theme[]) {
    test(`${theme}: beams with a selected card`, async ({ page }) => {
      await presetTheme(page, theme)
      await openPointMode(page, { camera: 'grant', geo: ON_THE_STREET, heading: FACING_NORTH })
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const view = pointMode(page)
      await view
        .getByRole('list', { name: /venues in view/i })
        .getByRole('listitem')
        .first()
        .waitFor({
          state: 'attached',
          timeout: 15_000,
        })
      await view.getByRole('button', { name: new RegExp(`^${MOCK_VENUES.popping.name}\\s?\\d`) }).click()
      await expect(view.getByRole('region', { name: /selected venue/i })).toBeVisible()
      await expectAxeCriticalsClean(page, `Point_Mode (${theme})`)
    })
  }
})
