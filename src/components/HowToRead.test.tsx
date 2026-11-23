import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { escapeLayerCount } from '../lib/escapeStack'
import { HowToRead } from './HowToRead'

afterEach(cleanup)

const BANDS = { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 }

function Page() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        How to read
      </button>
      {open && <HowToRead bands={BANDS} onClose={() => setOpen(false)} />}
    </>
  )
}

describe('How to read', () => {
  it('opens as a dialog with every term, and the bands from the night', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'How to read' }))
    const dialog = screen.getByRole('dialog', { name: 'How to read' })
    expect(dialog.tagName).toBe('DIALOG')
    const terms = [...dialog.querySelectorAll('dt')].map((d) => d.textContent)
    expect(terms).toEqual([
      'Kupon',
      'Total odds · Probability',
      'Our chance',
      'Bet',
      'Gap',
      'Closer',
      'Value rungs',
      'Rungs read closer',
      'Bands',
    ])
    expect(dialog.textContent).toContain('Points 5, rebounds and assists 2, 3PM, steals and blocks 1')
    expect(dialog.textContent).toContain('+1 rebounds and +2.5 points weigh the same')
    expect(dialog.textContent).toContain('scoring every rung asks both sides the same fair question') // from the old Scorecard
  })

  it('closes on Esc and gives focus back to the button that opened it', () => {
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'How to read' })
    opener.focus()
    fireEvent.click(opener)
    expect(escapeLayerCount()).toBe(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(escapeLayerCount()).toBe(0)
    expect(document.activeElement).toBe(opener)
  })

  it('closes from its X and from the backdrop, not from a click inside', () => {
    const onClose = vi.fn()
    render(<HowToRead bands={null} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'How to read' })
    fireEvent.click(screen.getByRole('heading', { name: 'How to read' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(dialog)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    // without a night there are no bands to print
    expect([...dialog.querySelectorAll('dt')].map((d) => d.textContent)).not.toContain('Bands')
  })
})
