import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Game, GameLine, LineupSpot } from '../api/client'
import { setPlayerCardHost } from '../lib/playerCard'
import { buildRows } from '../lib/myPlayers'
import { Row } from './QuietField'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

const spot = (id: number, name: string, game_id: number | null): LineupSpot => ({
  player_id: id,
  name,
  pro_team_id: 1,
  slot: 'PG',
  slot_id: 0,
  starting: true,
  injury_status: 'ACTIVE',
  game_id,
  eligible: ['PG'],
})

const line = (id: number): GameLine => ({
  player_id: id,
  name: `Player ${id}`,
  pro_team_id: 1,
  owner_team_id: 3,
  minutes: 30,
  pts: 21,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 0,
  tpm: 2,
  to: 2,
  fgm: 6,
  fga: 12,
  ftm: 2,
  fta: 2,
  starter: true,
})

const game = (id: number, lines: GameLine[]): Game => ({
  id,
  start: '2026-11-11T01:00:00Z',
  status: 'live',
  clock: 'Q4 4:12',
  away: { pro_team_id: 1, abbrev: 'BOS', name: 'Boston', score: 98 },
  home: { pro_team_id: 2, abbrev: 'PHI', name: 'Philadelphia', score: 94 },
  lines,
})

function renderRow(s: LineupSpot, games: Game[]) {
  const [row] = buildRows([s], games)
  return render(
    <ol>
      <Row row={row} names={new Map([[s.name, s.name.split(' ').pop()!]])} />
    </ol>,
  )
}

describe('Quiet Field row', () => {
  it('makes face, name and game line one button that opens the card', () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const { container } = renderRow(spot(7, 'Jayson Tatum', 1), [game(1, [line(7)])])
    const buttons = container.querySelectorAll('.tm-who button')
    expect(buttons).toHaveLength(1)
    const pick = buttons[0]
    expect(pick.classList.contains('tm-pick')).toBe(true)
    expect(pick.querySelector('.head')).not.toBeNull()
    expect(pick.querySelector('.tm-nm')?.textContent).toContain('Tatum')
    expect(pick.querySelector('.tm-st')?.textContent).toContain('Q4 4:12')
    fireEvent.click(screen.getByRole('button', { name: /Tatum/ }))
    expect(open).toHaveBeenCalledWith({ id: 7, name: 'Jayson Tatum' })
  })

  it('lets a row without figures run its words on (tm-q); a played row keeps its figures', () => {
    const idle = renderRow(spot(8, 'Jalen Brunson', null), [])
    const idleRow = idle.container.querySelector('.tm-row')!
    expect(idleRow.classList.contains('tm-q')).toBe(true)
    expect(idleRow.querySelector('.tm-stats')).toBeNull()
    idle.unmount()

    const played = renderRow(spot(7, 'Jayson Tatum', 1), [game(1, [line(7)])])
    const playedRow = played.container.querySelector('.tm-row')!
    expect(playedRow.classList.contains('tm-q')).toBe(false)
    expect(playedRow.querySelector('.tm-stats')).not.toBeNull()
  })
})
