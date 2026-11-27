import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ManagerStyles } from '../api/client'
import fixture from '../lib/managerStyles.fixture.json'
import { WinPathView } from './WinPath'

afterEach(cleanup)

const data = fixture as unknown as ManagerStyles

describe('WinPathView', () => {
  it('says how you play and what to lock, swing and let go', () => {
    render(<WinPathView data={data} />)
    expect(screen.getByText('Waiver hawk')).toBeTruthy()
    const headline = document.querySelector('.wp-headline')!.textContent
    expect(headline).toContain('We win on the wire.')
    expect(headline).toContain('Lock FG% and BLK')
    expect(headline).toContain('let the rest go')
  })

  it('points adds at what the path needs, in the site order, never at turnovers', () => {
    render(<WinPathView data={data} />)
    expect(document.querySelector('.wp-lead')!.textContent).toBe('Look for FT% and AST, without the turnovers.')
    expect(screen.getByText('FT% · AST · TO')).toBeTruthy()
    expect(screen.getByText('Wins').parentElement!.textContent).toBe('WinsFG% BLK')
  })

  it('places all nine categories on the board, in the site order', () => {
    render(<WinPathView data={data} />)
    const board = screen.getByRole('table', { name: /nine categories/ })
    const heads = within(board).getAllByRole('columnheader').map((h) => h.firstChild?.textContent)
    expect(heads).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO↓', 'PTS'])
    // TO↓ as everywhere on the site, no "lower wins" sub-label; screen readers still hear it
    const to = within(board).getAllByRole('columnheader')[7]
    expect(to.querySelector('small')).toBeNull()
    expect(to.querySelector('.sr-only')?.textContent).toBe('turnovers, lower wins')
    expect(within(board).getByLabelText(/^FG%: Lock, 100%/)).toBeTruthy()
    expect(within(board).getByLabelText(/^PTS: Let go, 0%/)).toBeTruthy()
  })

  it('keeps only the notes the board, headline and adds panel do not already say', () => {
    render(<WinPathView data={data} />)
    const notes = screen.getByRole('list', { name: 'The read on us' }).textContent
    expect(notes).toContain('adds this season')
    expect(notes).toContain('never came home')
    expect(notes).not.toContain('are the coin flips')
    expect(notes).not.toContain('Our adds bring')
    expect(screen.queryByRole('button', { name: /More/ })).toBeNull()
    expect(document.querySelector('.wp-sub')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Your win path' })).toBeTruthy()
  })

  it('renders nothing before any week is finished', () => {
    const { container } = render(<WinPathView data={{ ...data, weeks: 0 }} />)
    expect(container.firstChild).toBeNull()
  })
})
