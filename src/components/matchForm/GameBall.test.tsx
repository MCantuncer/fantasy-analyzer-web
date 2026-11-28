import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dayDate, heroGame, shootingPct } from '../../lib/matchForm'
import type { FormGame, FormStar, MatchForm, TeamForm } from '../../lib/matchForm'
import { setPlayerCardHost } from '../../lib/playerCard'
import { FormView } from './FormView'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

const star = (name: string, team: string, pts: number, id = pts): FormStar => ({
  player_id: id,
  name,
  team,
  game_score: pts / 1.5,
  minutes: 35,
  pts,
  reb: 6,
  ast: 5,
  stl: 2,
  blk: 1,
  tpm: 3,
  to: 2,
  fgm: 12,
  fga: 23,
  ftm: 7,
  fta: 8,
})

function game(id: number, date: string, home: boolean, opponent: string, points: number, opp: number, mine: string): FormGame {
  const won = points > opp
  const ours = star(`${mine} Lead ${id}`, mine, 30 + id)
  const theirs = star(`${opponent} Lead ${id}`, opponent, 20 + id)
  return {
    game_id: id,
    date,
    start: `${date}T23:00:00Z`,
    home,
    neutral: false,
    kind: id === 3 ? 'cup' : 'regular',
    note: id === 3 ? 'NBA Cup - Group Play' : null,
    opponent,
    opponent_name: opponent,
    points,
    opponent_points: opp,
    won,
    mvp: won ? ours : theirs,
    best: ours,
    opp_best: theirs,
  }
}

const team = (abbrev: string, name: string, games: FormGame[]): TeamForm => ({
  abbrev,
  name,
  wins: games.filter((g) => g.won).length,
  losses: games.filter((g) => !g.won).length,
  games,
})

// Pacers: newest first; game 3 is the meeting with the Knicks (an NBA Cup night at home, a Pacers win).
const IND = team('IND', 'Indiana Pacers', [
  game(1, '2026-11-20', false, 'CLE', 119, 128, 'IND'),
  game(2, '2026-11-18', true, 'HOU', 104, 119, 'IND'),
  game(3, '2026-11-13', true, 'NY', 106, 104, 'IND'),
  game(4, '2026-11-09', false, 'DAL', 122, 125, 'IND'),
])
const NY = team('NY', 'New York Knicks', [
  game(5, '2026-11-21', true, 'POR', 97, 96, 'NY'),
  // the same game from the Knicks' side: the same players on it
  {
    ...game(3, '2026-11-13', false, 'IND', 104, 106, 'NY'),
    mvp: IND.games[2].mvp,
    best: IND.games[2].opp_best ?? null,
    opp_best: IND.games[2].best,
    kind: 'cup',
    note: 'NBA Cup - Group Play',
  },
])
const FORM: MatchForm = { away: IND, home: NY, next: null }

const ball = () => screen.getByRole('region', { name: 'Game Ball' })

describe('Game Ball', () => {
  it('opens on their last meeting with the MVP, his full line and the other side’s best', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="home" />)
    const gb = within(ball())
    expect(gb.getByText('Game Ball · Last Meeting')).toBeTruthy()
    expect(gb.getByText('IND Lead 3')).toBeTruthy()
    expect(gb.getByLabelText('NY 104 at IND 106')).toBeTruthy()
    expect(gb.getByText('Final · Fri Nov 13')).toBeTruthy()
    expect(gb.getByText('NBA Cup')).toBeTruthy()
    const stats = ball().querySelectorAll('.mf-stat dt')
    expect([...stats].map((d) => d.textContent)).toEqual(['MIN', 'FG', 'FT', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    expect(ball().querySelector('.mf-stat.pts dd')?.textContent).toBe('33')
    expect(ball().textContent).toContain("Knicks' best: NY Lead 3")
    // The meeting is lit in the Knicks list and in both lanes of the Tape: the same game.
    const lit = screen.getAllByRole('button', { pressed: true })
    expect(lit.map((b) => b.className)).toEqual(['mf-col', 'mf-col', 'mf-row'])
    expect(lit.every((b) => b.getAttribute('aria-label')?.includes('Nov 13'))).toBe(true)
    expect(screen.queryByRole('button', { name: /Back To/ })).toBeNull()
  })

  it('puts a tapped game on the Game Ball and comes back to the meeting', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    fireEvent.click(screen.getByRole('button', { name: /^Nov 20, at CLE/ }))
    expect(within(ball()).getByText('Game Ball · Pacers at Cavaliers')).toBeTruthy()
    expect(within(ball()).getByText('CLE Lead 1')).toBeTruthy()
    expect(ball().textContent).toContain("Pacers' best: IND Lead 1")
    fireEvent.click(screen.getByRole('button', { name: 'Back To Last Meeting' }))
    expect(within(ball()).getByText('Game Ball · Last Meeting')).toBeTruthy()
  })

  it('steps Earlier and Later through the list on screen', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    const earlier = () => within(ball()).getAllByRole('button', { name: /Earlier/ })[0] as HTMLButtonElement
    const later = () => within(ball()).getAllByRole('button', { name: /Later/ })[0] as HTMLButtonElement
    fireEvent.click(earlier())
    expect(within(ball()).getByText('DAL Lead 4')).toBeTruthy()
    expect(earlier().disabled).toBe(true)
    fireEvent.click(later())
    fireEvent.click(later())
    fireEvent.click(later())
    expect(within(ball()).getByText('CLE Lead 1')).toBeTruthy()
    expect(later().disabled).toBe(true)
  })

  it("follows tonight's venue: the latest game there, and a venue change drops the pick", () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    fireEvent.click(screen.getByRole('button', { name: /^Nov 18, vs HOU/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Tonight's Venue/ }))
    expect(within(ball()).getByText('Game Ball · Pacers at Cavaliers')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Back To/ })).toBeNull()
  })

  it('turns to the other team on the first tab tap, Game Ball and list together', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    fireEvent.click(screen.getByRole('button', { name: /^Nov 20, at CLE/ }))
    expect(within(ball()).getByText('CLE Lead 1')).toBeTruthy()
    // one tap on Knicks: their last meeting, seen from their side, with no stale Pacers pick
    fireEvent.click(screen.getByRole('tab', { name: /Knicks/ }))
    expect(within(ball()).getByText('Game Ball · Last Meeting')).toBeTruthy()
    expect(ball().textContent).toContain("Knicks' best: NY Lead 3")
    expect(screen.queryByRole('button', { name: /Back To/ })).toBeNull()
    const list = within(screen.getByRole('tabpanel')).getAllByRole('listitem')
    expect(list).toHaveLength(2)
    // Earlier walks the Knicks list from the meeting, which is its oldest game
    expect((within(ball()).getAllByRole('button', { name: /Earlier/ })[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(ball()).getAllByRole('button', { name: /Later/ })[0])
    expect(within(ball()).getByText(/^Game Ball · Knicks vs \w*Blazers$/)).toBeTruthy()
  })

  it("follows the tab under tonight's venue too: that team's latest game there", () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    fireEvent.click(screen.getByRole('radio', { name: /Tonight's Venue/ }))
    expect(within(ball()).getByText('Game Ball · Pacers at Cavaliers')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Knicks/ }))
    expect(within(ball()).getByText(/^Game Ball · Knicks vs \w*Blazers$/)).toBeTruthy()
  })

  it('reads the helpers', () => {
    expect(dayDate('2026-11-20')).toBe('Fri Nov 20')
    expect(dayDate(null)).toBe('')
    expect(shootingPct(13, 25)).toBe('.520')
    expect(shootingPct(2, 2)).toBe('1.000')
    expect(shootingPct(0, 0)).toBe('–')
    const shown = { away: IND.games, home: NY.games }
    expect(heroGame(FORM, shown, null, false, 'home')?.game.game_id).toBe(3)
    expect(heroGame(FORM, shown, null, true, 'home')?.game.game_id).toBe(5)
    expect(heroGame(FORM, shown, { side: 'away', game_id: 99 }, false, 'away')?.picked).toBe(false)
    // a pick from the other team never holds the Game Ball once the tabs show this one
    expect(heroGame(FORM, shown, { side: 'away', game_id: 1 }, false, 'home')).toEqual({
      side: 'home',
      game: NY.games[1],
      picked: false,
    })
    expect(heroGame({ ...FORM, away: { ...IND, games: [] } }, { away: [], home: [] }, null, false, 'away')).toBeNull()
  })
  it("opens the star's and the other side's best player's cards from their names and faces", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    render(<FormView form={FORM} venueNeutral={false} initialSide="home" />)
    const gb = within(ball())
    fireEvent.click(gb.getByRole('button', { name: 'IND Lead 3' }))
    expect(open).toHaveBeenLastCalledWith({ id: 33, name: 'IND Lead 3' })
    fireEvent.click(gb.getByRole('button', { name: 'NY Lead 3' }))
    expect(open).toHaveBeenLastCalledWith({ id: 23, name: 'NY Lead 3' })
    // the faces open the same cards, out of the tab order beside the linked names
    const faces = [...ball().querySelectorAll<HTMLButtonElement>('button.pc-link-face')]
    expect(faces).toHaveLength(2)
    expect(faces.every((f) => f.tabIndex === -1 && f.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(faces[0].querySelector('.mf-gb-face img')).toBeTruthy()
    expect(faces[1].querySelector('.head')).toBeTruthy()
    fireEvent.click(faces[0])
    expect(open).toHaveBeenLastCalledWith({ id: 33, name: 'IND Lead 3' })
    expect(ball().textContent).toContain("Knicks' best: NY Lead 3")
  })

  it("puts a tapped row's Game Ball up with its star's name opening his card", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    const row = screen.getByRole('button', { name: /^Nov 20, at CLE/ })
    // the row is one button: its face stays a picture and its name is read in the row's label
    expect(row.querySelector('button')).toBeNull()
    expect(row.querySelector('.mf-r-mvp .head')).toBeTruthy()
    fireEvent.click(row)
    fireEvent.click(within(ball()).getByRole('button', { name: 'CLE Lead 1' }))
    expect(open).toHaveBeenLastCalledWith({ id: 21, name: 'CLE Lead 1' })
  })

  it('keeps the names as plain text with no card to open', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="home" />)
    expect(ball().querySelector('.pc-link')).toBeNull()
    expect(within(ball()).getByText('IND Lead 3')).toBeTruthy()
    expect(ball().querySelector('.mf-gb-other .head')).toBeTruthy()
  })
})
