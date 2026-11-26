import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(heads).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    expect(within(board).getByLabelText(/^FG%: Lock, 100%/)).toBeTruthy()
    expect(within(board).getByLabelText(/^PTS: Let go, 0%/)).toBeTruthy()
  })

  it('shows three notes and folds the rest behind More', () => {
    render(<WinPathView data={data} />)
    const more = screen.getByRole('button', { name: /More/ })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(screen.getByRole('button', { name: /Less/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/adds this season/)).toBeTruthy()
  })

  it('renders nothing before any week is finished', () => {
    const { container } = render(<WinPathView data={{ ...data, weeks: 0 }} />)
    expect(container.firstChild).toBeNull()
  })
})
