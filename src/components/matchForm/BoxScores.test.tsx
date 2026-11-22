import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { lastName } from '../../lib/matchForm'
import type { FormGame, FormStar, GameKind, MatchForm, TeamForm } from '../../lib/matchForm'
import { FormView } from './FormView'

afterEach(cleanup)

const star = (name: string, team: string, pts: number): FormStar => ({
  player_id: pts,
  name,
  team,
  game_score: pts / 2,
  minutes: 34,
  pts,
  reb: 5,
  ast: 4,
  stl: 1,
  blk: 0,
  tpm: 2,
  to: 2,
  fgm: 8,
  fga: 16,
  ftm: 3,
  fta: 4,
})

type Row = [string, 'home' | 'road' | 'neutral', string, number, number, GameKind]

function team(abbrev: string, name: string, rows: Row[]): TeamForm {
  const games: FormGame[] = rows.map(([date, where, opponent, points, opp, kind], i) => ({
    game_id: abbrev.length * 1000 + i,
    date,
    start: `${date}T23:00:00Z`,
    home: where === 'home',
    neutral: where === 'neutral',
    kind,
    note: kind === 'cup' ? 'NBA Cup - Group Play' : where === 'neutral' ? 'NBA Mexico City Game' : null,
    opponent,
    opponent_name: opponent,
    points,
    opponent_points: opp,
    won: points > opp,
    mvp: points > opp ? star(`${abbrev} Star ${i}`, abbrev, 30 - i) : star(`${opponent} Star ${i}`, opponent, 20 + i),
    best: null,
    opp_best: null,
  }))
  const wins = games.filter((g) => g.won).length
  return { abbrev, name, wins, losses: games.length - wins, games }
}

// Twelve Pacers games, newest first: a Mexico City game and two NBA Cup nights among them.
const IND = team('IND', 'Indiana Pacers', [
  ['2026-11-20', 'road', 'CLE', 119, 128, 'cup'],
  ['2026-11-18', 'home', 'HOU', 104, 119, 'regular'],
  ['2026-11-15', 'road', 'PHI', 124, 131, 'regular'],
  ['2026-11-13', 'home', 'NY', 106, 104, 'cup'],
  ['2026-11-11', 'home', 'WSH', 114, 101, 'regular'],
  ['2026-11-09', 'road', 'DAL', 122, 125, 'regular'],
  ['2026-11-07', 'neutral', 'DEN', 102, 114, 'regular'],
  ['2026-11-04', 'road', 'MEM', 107, 103, 'regular'],
  ['2026-11-02', 'home', 'ATL', 104, 108, 'regular'],
  ['2026-11-01', 'home', 'BKN', 90, 98, 'regular'],
  ['2026-10-30', 'road', 'MIA', 125, 145, 'cup'],
  ['2026-10-28', 'home', 'PHI', 109, 114, 'regular'],
])
const NY = team('NY', 'New York Knicks', [
  ['2026-11-21', 'home', 'POR', 97, 96, 'regular'],
  ['2026-11-19', 'road', 'MIN', 102, 99, 'regular'],
])
const FORM: MatchForm = { away: IND, home: NY, next: null }

const rows = () => within(screen.getByRole('tabpanel')).getAllByRole('listitem')

describe('Last 10', () => {
  it('lists the backed side’s last ten games, newest first, with type and Game Ball', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    expect(screen.getByRole('tab', { name: /Pacers/ }).getAttribute('aria-selected')).toBe('true')
    const list = rows()
    expect(list).toHaveLength(10)
    expect(list[0].getAttribute('aria-label')).toBe(
      'Nov 20, at CLE, lost 119-128, NBA Cup, Group Play, Game Ball CLE Star 0, 20 points',
    )
    expect(list[3].getAttribute('aria-label')).toContain('vs NY, won 106-104')
    expect(list[6].getAttribute('aria-label')).toContain('neutral site, DEN')
    expect(list[6].getAttribute('aria-label')).toContain('Regular Season, Mexico City Game')
    // The MVP from the other club carries his club; ours does not.
    expect(within(list[0]).getByText(/CLE ·/)).toBeTruthy()
    expect(within(list[3]).queryByText(/IND ·/)).toBeNull()
  })

  it("follows the venue switch: road games only for the visitor, never the neutral site", () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    fireEvent.click(screen.getByRole('radio', { name: /Tonight's Venue/ }))
    const labels = rows().map((r) => r.getAttribute('aria-label'))
    expect(labels).toHaveLength(5)
    expect(labels.every((l) => l?.includes(', at '))).toBe(true)
    expect(screen.getByRole('tabpanel').getAttribute('aria-label')).toBe('Indiana Pacers, last 5 on the road')
  })

  it('switches team with a click or the arrow keys', () => {
    render(<FormView form={FORM} venueNeutral={false} initialSide="away" />)
    fireEvent.click(screen.getByRole('tab', { name: /Knicks/ }))
    expect(rows()).toHaveLength(2)
    fireEvent.keyDown(screen.getByRole('tab', { name: /Knicks/ }), { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: /Pacers/ }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: /Pacers/ }))
  })

  it('says so when a side has no games in view', () => {
    const empty: MatchForm = { ...FORM, home: { ...NY, games: NY.games.filter((g) => !g.home) } }
    render(<FormView form={empty} venueNeutral={false} initialSide="home" />)
    fireEvent.click(screen.getByRole('radio', { name: /Tonight's Venue/ }))
    expect(screen.getByRole('tabpanel').textContent).toBe('No games at home yet this season.')
  })

  it('shortens names to the last name for phones', () => {
    expect(lastName('Karl-Anthony Towns')).toBe('Towns')
    expect(lastName('Jaren Jackson Jr.')).toBe('Jackson Jr.')
    expect(lastName('Nenê')).toBe('Nenê')
  })
})
