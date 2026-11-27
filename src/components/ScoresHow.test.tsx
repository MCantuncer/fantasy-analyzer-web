import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScoresHow } from './ScoresHow'

afterEach(cleanup)

describe('ScoresHow', () => {
  it('opens three short notes from one bare row', () => {
    const { container } = render(<ScoresHow />)
    const row = screen.getByRole('button', { name: /How this works/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    const notes = container.querySelector('.sc-how-notes')!
    expect(row).toHaveAttribute('aria-controls', notes.id)
    expect(notes).not.toBeVisible()
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(notes).toBeVisible()
    const items = notes.querySelectorAll('li')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toMatch(
      /^Our call is our score for each game, locked at tip-off\. .*green sure, amber a lean, grey a coin flip\.$/,
    )
    expect(items[1].textContent).toMatch(/ESPN's fantasy stats/)
    expect(items[2].textContent).toBe('Owner in a box score is the fantasy team in this league.')
  })
})
