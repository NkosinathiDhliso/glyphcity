// @vitest-environment jsdom
/**
 * Wordmark and Logo_Mark (glyphcity-rebrand R5.7, R5.8).
 *
 * **Validates: Requirements 5.7, 5.8**
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { APP_NAME } from '../../constants/brand'
import { LogoMark } from '../LogoMark'
import { Wordmark } from '../Wordmark'

afterEach(cleanup)

describe('Wordmark', () => {
  it('renders APP_NAME lowercase with the Brand_Name as its accessible name', () => {
    render(<Wordmark />)
    const mark = screen.getByRole('img', { name: APP_NAME })
    expect(mark.textContent).toBe(APP_NAME.toLowerCase())
  })

  it('uses Funnel Display 800, -0.05em tracking, in ink', () => {
    render(<Wordmark size="lg" />)
    const cls = screen.getByRole('img', { name: APP_NAME }).className
    for (const c of [
      'font-display',
      'font-extrabold',
      'tracking-[-0.05em]',
      'text-[var(--text-primary)]',
      'text-3xl',
    ]) {
      expect(cls).toContain(c)
    }
  })
})

describe('LogoMark', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'assets', 'logo-mark.svg'), 'utf8')

  it('renders the logo-mark.svg geometry in currentColor, decorative', () => {
    const { container } = render(<LogoMark size={13} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 34')
    expect(svg?.getAttribute('width')).toBe('13')
    const circle = svg?.querySelector('circle')
    expect(circle?.getAttribute('fill')).toBe('currentColor')
    expect(source).toContain(`d="${svg?.querySelector('path')?.getAttribute('d')}"`)
  })

  it('gives each instance its own gradient id', () => {
    const { container } = render(
      <>
        <LogoMark size={13} />
        <LogoMark size={13} />
      </>,
    )
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(2)
    for (const path of container.querySelectorAll('path')) {
      const ref = path.getAttribute('fill')?.match(/url\(#(.+)\)/)?.[1]
      expect(ids).toContain(ref)
    }
  })
})
