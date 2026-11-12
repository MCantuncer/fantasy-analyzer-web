import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SignInHero } from './SignInHero'

describe('SignInHero', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('reads as COURT and the five words once; the drawn rows are hidden', () => {
    const { container } = render(<SignInHero />)
    expect(screen.getByRole('heading', { name: 'COURT' })).toBeInTheDocument()
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual([
      'Categories: 9-cat standings, all week',
      'Odds: Playoff odds, simulated',
      'Upgrades: Free agents worth a pickup',
      'Rosters: Every team’s roster',
      'Trades: Ranked by playoff odds',
    ])
    expect(container.querySelector('.hero-rows')).toHaveAttribute('aria-hidden', 'true')
  })

  it('drops the words in only on the first visit on a device', () => {
    const first = render(<SignInHero />)
    expect(first.container.querySelector('.signin-hero')).toHaveClass('drop')
    cleanup()
    const again = render(<SignInHero />)
    expect(again.container.querySelector('.signin-hero')).not.toHaveClass('drop')
  })
})
