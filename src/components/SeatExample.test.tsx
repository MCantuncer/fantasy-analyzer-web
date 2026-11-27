import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SeatExample } from './SeatExample'

afterEach(cleanup)

describe('SeatExample', () => {
  it('is a labelled section whose example panel is inert and hidden from screen readers', () => {
    const { container } = render(<SeatExample />)
    expect(screen.getByRole('region', { name: 'Once you pick your team' })).toBeTruthy()
    const panel = container.querySelector('.lx-panel') as HTMLElement
    expect(panel.hasAttribute('inert')).toBe(true)
    expect(panel.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText(/your matchup live, your playoff odds, and your best trade every morning/)).toBeTruthy()
  })

  it('offers nothing to press: no buttons, links or a second Pick my team', () => {
    const { container } = render(<SeatExample />)
    expect(container.querySelectorAll('button, a, [role="button"], [tabindex]')).toHaveLength(0)
    expect(screen.queryByText('Pick my team')).toBeNull()
  })

  it('shows the three pieces: the live matchup, the odds ladder and the best trade', () => {
    const { container } = render(<SeatExample />)
    const heads = [...container.querySelectorAll('.lx-ph')].map((h) => h.textContent)
    expect(heads).toEqual(['Your matchup, live', 'Your playoff odds', 'Your best trade, every morning'])
    expect(container.querySelector('.lx-score')?.textContent).toContain('2–5–2')
    expect(container.querySelectorAll('.cs-pi')).toHaveLength(9)

    const rungs = [...container.querySelectorAll('.lx-rung')]
    expect(rungs).toHaveLength(10)
    expect(rungs.findIndex((r) => r.classList.contains('lx-you'))).toBe(5)
    expect(rungs.findIndex((r) => r.classList.contains('lx-cut'))).toBe(6)

    expect(container.querySelectorAll('.lx-swap .head, .lx-swap svg.head-sil')).not.toHaveLength(0)
    expect(container.querySelector('.lx-trade')?.textContent).toContain('56%from 54%+2 pts')
  })
})
