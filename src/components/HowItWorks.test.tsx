import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HowItWorks } from './HowItWorks'

afterEach(cleanup)

describe('HowItWorks', () => {
  it('is one bare row that opens its columns and notes', () => {
    const { container } = render(
      <HowItWorks
        parts={[
          { title: 'The model', body: '10,000 season simulations, run in 4.2s.' },
          { title: 'Expected gain', body: 'Your odds gain times the chance they say yes.' },
        ]}
        notes={['Rest-of-season projections.', 'Free agents are checked against your weakest spot.']}
      />,
    )
    const row = screen.getByRole('button', { name: 'How this works' })
    const body = container.querySelector('.hiw-body') as HTMLElement
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(row).toHaveAttribute('aria-controls', body.id)
    expect(body).not.toBeVisible()
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(body).toBeVisible()
    expect([...body.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['The model', 'Expected gain'])
    expect(body.querySelectorAll('.hiw-notes li')).toHaveLength(2)
  })

  it('has no sub-line on the closed row', () => {
    render(<HowItWorks notes={['A note.']} />)
    expect(screen.getByRole('button').textContent).toBe('How this works')
  })
})
