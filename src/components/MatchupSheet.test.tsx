import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CategoryScore, DayLineup, LineupSpot, ScoreDay } from '../api/client'
import { todayLine } from '../lib/matchupSheet'
import type { TodayData } from '../lib/todayData'
import { game, line } from '../test/fixtures'
import { FlipLine, MatchupSheet, type SheetSide } from './MatchupSheet'

afterEach(cleanup)

// The Line Score snapshot: Kucukesat Aspavas against Çayyolu Bastards, 2–5–2 today, 4–4–1 this week.
const STATS = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const week = (values: number[], results: string): CategoryScore[] =>
  STATS.map((stat, i) => ({ stat, value: values[i], result: results[i] }))
const KA: SheetSide = {
  id: 3,
  name: 'Kucukesat Aspavas',
  colour: '#f5b53d',
  week: week([0.509, 0.744, 60, 225, 134, 37, 25, 62, 539], 'WLLWLTWWL'),
  left: 21,
}
const CB: SheetSide = {
  id: 6,
  name: 'Çayyolu Bastards',
  colour: '#a3e35a',
  week: week([0.476, 0.746, 82, 181, 144, 37, 11, 69, 669], 'LWWLWTLLW'),
  left: 22,
}

const SCORES: ScoreDay = {
  league_id: 1,
  season: 2027,
  day: 34,
  date: '2026-11-22',
  live: true,
  updated_at: '2026-11-21T21:29:00Z',
  complete: true,
  days: [],
  week: [],
  games: [
    game({
      id: 1,
      status: 'live',
      clock: 'Q3 2:10',
      lines: [
        line({
          player_id: 1,
          name: 'Donovan Mitchell',
          fgm: 5,
          fga: 10,
          ftm: 2,
          fta: 2,
          tpm: 1,
          reb: 6,
          ast: 5,
          stl: 1,
          blk: 0,
          to: 3,
          pts: 21,
        }),
        line({
          player_id: 2,
          name: 'Jalen Brunson',
          fgm: 3,
          fga: 7,
          ftm: 4,
          fta: 4,
          tpm: 5,
          reb: 30,
          ast: 16,
          stl: 5,
          blk: 0,
          to: 5,
          pts: 53,
        }),
      ],
    }),
    game({ id: 2, status: 'scheduled', start: '2026-11-22T00:30:00Z', lines: [] }),
  ],
}

const spot = (player_id: number, name: string, slot: string, game_id: number | null): LineupSpot => ({
  player_id,
  name,
  pro_team_id: 10,
  slot,
  slot_id: 0,
  starting: slot !== 'BE' && slot !== 'IR',
  injury_status: 'ACTIVE',
  game_id,
  eligible: ['UTIL'],
})
const lineup = (team_id: number, spots: LineupSpot[]): DayLineup => ({
  league_id: 1,
  season: 2027,
  team_id,
  day: 34,
  date: '2026-11-22',
  spots,
  open_slots: [],
  fetched_at: '2026-11-21T21:29:00Z',
})
const TODAY: TodayData = {
  scores: SCORES,
  lineups: [
    lineup(3, [
      spot(1, 'Donovan Mitchell', 'PG', 1),
      spot(3, 'Jayson Tatum', 'SF', 2),
      spot(5, 'Ajay Mitchell', 'BE', null),
    ]),
    lineup(6, [spot(2, 'Jalen Brunson', 'PG', 1), spot(4, 'Kevin Durant', 'SF', 2), spot(6, 'Cam Thomas', 'SF', 2)]),
  ],
  stale: false,
  refetch: () => {},
}

const sheet = (over: Partial<Parameters<typeof MatchupSheet>[0]> = {}) =>
  render(
    <MatchupSheet
      title="Your matchup"
      a={KA}
      b={CB}
      mine
      week={{ wins: 4, losses: 4, ties: 1 }}
      view="today"
      canToday
      onView={() => {}}
      today={TODAY}
      myId={3}
      {...over}
    />,
  )

const items = () => within(screen.getByRole('list', { name: /categories/ })).getAllByRole('listitem')

describe('todayLine', () => {
  it("reads today's score, who's still to come and the strip's figures from the two lineups", () => {
    const l = todayLine(TODAY)
    expect(l.rec).toEqual({ wins: 2, losses: 5, ties: 2 })
    expect(l.toCome).toEqual([1, 2])
    expect(l.live).toBe(true)
    expect(l.figures[0].find((v) => v.stat === 'FG%')!.value).toBe(0.5)
    expect(l.figures[1].find((v) => v.stat === 'FG%')!.value).toBe(0.429)
  })
})

describe('MatchupSheet', () => {
  it('Today: the score reads 2–5–2 with the week under it, and the lineup is open', () => {
    sheet()
    expect(screen.getByRole('img', { name: /Today 2 won, 5 lost, 2 tied\. Week 4–4–1\./ })).toBeTruthy()
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Your players' })).toBeTruthy()
    // The sheet draws the score and the categories itself: no second score or tiles from the lineup.
    expect(document.querySelector('.tm-score, .tm-tiles')).toBeNull()
  })

  it('the strip has nine labelled categories, close on the four the week can still flip', () => {
    sheet()
    const list = items()
    expect(list).toHaveLength(9)
    expect(list[0].getAttribute('aria-label')).toBe('FG%: you .500, Bastards .429, you lead. Week .509 to .476')
    const close = list.filter((li) => li.getAttribute('aria-label')!.includes('Close this week'))
    expect(close.map((li) => li.getAttribute('aria-label')!.split(':')[0])).toEqual(['FT%', 'AST', 'STL', 'TO'])
  })

  it('marks your team with the badge on your crest, never an icon beside the name', () => {
    sheet()
    // On the scoreboard crest and the strip's key crest, and nowhere loose.
    const badges = document.querySelectorAll('.yourcrest > .yourcrest-me')
    expect(badges).toHaveLength(2)
    expect(document.querySelectorAll('.cs-me, .yourcrest-me').length).toBe(2)
  })

  it('Week: the week score on top, today under it, and the week extras instead of the lineup', () => {
    sheet({ view: 'week', weekExtras: <p>Projected final</p> })
    expect(screen.getByRole('img', { name: /This week 4 won, 4 lost, 1 tied\. Today 2–5–2\./ })).toBeTruthy()
    expect(screen.getByText('Projected final')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Your players' })).toBeNull()
    expect(screen.getByText('21', { selector: 'b' }).parentElement!.textContent).toBe('21 games left')
  })

  it("someone else's matchup: week only, neutral bars, no badge", () => {
    sheet({ title: 'Matchup of the week', mine: false, view: 'week', canToday: false, today: null, myId: null })
    expect(screen.queryByRole('group', { name: 'Today or the whole week' })).toBeNull()
    expect(document.querySelector('.cs-help, .cs-hurt')).toBeNull()
    expect(document.querySelectorAll('.cs-neu').length).toBeGreaterThan(0)
    expect(screen.queryByRole('img', { name: 'your team' })).toBeNull()
  })
})

describe('FlipLine', () => {
  it('puts the categories of the flip hint in ink, next to a soft trade check', () => {
    let checked = 0
    render(<FlipLine hint="Flip FT%, AST or STL to win the week" onCheckTrade={() => checked++} />)
    expect([...document.querySelectorAll('.lms-hint b')].map((b) => b.textContent)).toEqual(['FT%', 'AST', 'STL'])
    expect(document.querySelector('.lms-hint')!.textContent).toBe('Flip FT%, AST or STL to win the week')
    fireEvent.click(screen.getByRole('button', { name: /Check a Trade With Them/ }))
    expect(checked).toBe(1)
  })

  it('is absent with nothing to flip and no trade check', () => {
    const { container } = render(<FlipLine hint={null} />)
    expect(container.firstChild).toBeNull()
  })
})
