/**
 * Landing copy leads with the room (north-star-alignment R1.4, R9.2).
 *
 * The first thing a guest reads is the map, not a prize. The `<h1>`, the three
 * value lines and the About block must not use the incentive words below, and
 * no text node may carry a stray `|` (the old subtitle shipped one).
 *
 * Runs logged out against the consumer app root, where `AuthLanding` renders.
 */

import { expect, test } from '../../support/fixtures.js'

/** Word-boundary match, so "leaderboards" in the About block is not "board". */
const BANNED = ['climb', 'board', 'rank', 'perks', 'points', 'streak']

const REGIONS = ['landing-hero', 'landing-value-lines', 'landing-about']

test.describe('landing copy (north-star-alignment R1)', () => {
  test('leads with the room: no incentive words and no stray pipe', async ({ page }) => {
    await page.goto('/')

    for (const id of REGIONS) {
      const region = page.getByTestId(id)
      await expect(region).toBeVisible()
      const text = await region.innerText()

      for (const word of BANNED) {
        expect(text, `"${word}" in ${id}`).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'))
      }
      expect(text, `"|" in ${id}`).not.toContain('|')
    }
  })

  test('the third value line describes a reward earned on arrival', async ({ page }) => {
    await page.goto('/')

    const lines = page.getByTestId('landing-value-lines')
    await expect(lines).toContainText('A reward from the room')
    await expect(lines).toContainText('Earned when you arrive.')
  })
})
