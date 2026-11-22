import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { FormGame, MatchForm, TeamForm } from '../../lib/matchForm'
import { FormView } from './FormView'

afterEach(cleanup)

function team(abbrev: string, name: string, rows: [number, number, boolean, string][]): TeamForm {
  const games: FormGame[] = rows.map(([points, opp, home, opponent], i) => ({
    game_id: abbrev.length * 100 + i,
    date: `2026-11-${String(20 - i).padStart(2, '0')}`,
    start: '',
    home,
    neutral: false,
    kind: 'regular',
    note: null,
    opponent,
    opponent_name: opponent,
    points,
    opponent_points: opp,
    won: points > opp,
    mvp: null,
    best: null,
  }))
  const wins = games.filter((g) => g.won).length
  return { abbrev, name, wins, losses: games.length - wins, games }
}

// Knicks: 7 games, newest first, one a 44-point win.
const NY = team('NY', 'New York Knicks', [
  [97, 96, true, 'POR'],
  [102, 99, false, 'MIN'],
  [111, 102, false, 'TOR'],
  [112, 108, false, 'TOR'],
  [104, 106, false, 'IND'],
  [135, 91, true, 'CHI'],
  [103, 90, true, 'BKN'],
])
const IND = team('IND', 'Indiana Pacers', [
  [119, 128, false, 'CLE'],
  [104, 119, true, 'HOU'],
])
const FORM: MatchForm = { away: IND, home: NY, next: null }

const lane = (name: RegExp) => screen.getByRole('group', { name })

describe('The Tape', () => {
  it('draws each lane oldest to newest, with empty slots, capped bars and the last-5 edge', () => {
    render(<FormView form={FORM} venueNeutral={false} tip="2026-11-23T00:00:00Z" />)
    const ny = lane(/^Knicks, last 7, oldest to newest/)
    const bars = within(ny).getAllByRole('button')
    expect(bars).toHaveLength(7)
    expect(bars[0].getAttribute('aria-label')).toBe('Sat Nov 14, vs Nets, won 103-90, +13')
    expect(bars[6].getAttribute('aria-label')).toBe('Fri Nov 20, vs Blazers, won 97-96, +1')
    expect(ny.querySelectorAll('.mf-col.gap')).toHaveLength(3)
    expect(ny.querySelectorAll('.bar.cap')).toHaveLength(1) // +44 stops at 20
    expect(within(bars[1]).getByText('+44')).toBeTruthy()
    expect(ny.querySelectorAll('.mf-col.old')).toHaveLength(2)
    expect(ny.querySelector('.mf-edge.hot')?.textContent).toBe('Last 5')
    expect(lane(/^Pacers, last 2/).querySelector('.mf-edge')?.textContent).toBe('Last 2')
  })

  it('puts a tapped bar on the Game Ball and turns the list to that team', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    const bar = within(lane(/^Knicks/)).getByRole('button', { name: /vs Bulls/ })
    fireEvent.click(bar)
    expect(bar.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('tab', { name: /Knicks/ }).getAttribute('aria-selected')).toBe('true')
    expect(within(screen.getByRole('region', { name: 'Game Ball' })).getByText('Game Ball · Knicks vs Bulls')).toBeTruthy()
  })

  it('is one tab stop per lane, moved with the arrow keys', () => {
    render(<FormView form={FORM} venueNeutral={false} />)
    const bars = within(lane(/^Knicks/)).getAllByRole('button')
    expect(bars.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    bars[6].focus()
    fireEvent.keyDown(bars[6], { key: 'Home' })
    expect(document.activeElement).toBe(bars[0])
    fireEvent.keyDown(bars[0], { key: 'ArrowRight' })
    expect(document.activeElement).toBe(bars[1])
    expect(bars[1].tabIndex).toBe(0)
    expect(bars[6].tabIndex).toBe(-1)
  })
})
