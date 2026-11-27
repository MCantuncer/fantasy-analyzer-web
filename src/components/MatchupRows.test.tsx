import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CategoryScore, LeagueOverview, MatchupSide, OverviewMatchup } from '../api/client'
import { LeagueWire } from './LeagueWire'
import { withinOne } from '../lib/matchupSheet'
import { MatchupRows } from './MatchupRows'

// No live data in these tests: the box shows the week strip only.
vi.mock('../lib/todayData', () => ({
  todayMatters: () => false,
  useTodayMatchup: () => ({ data: null, loading: false, failed: false, inWeek: null }),
}))

afterEach(cleanup)

const STATS = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const cats = (results: string): CategoryScore[] => STATS.map((stat, i) => ({ stat, value: i + 1, result: results[i] }))
const side = (team_id: number, wins: number, losses: number, ties = 0, results?: string): MatchupSide => ({
  team_id,
  wins,
  losses,
  ties,
  categories: results ? cats(results) : [],
})

const NAMES: Record<number, string> = {
  1: 'Los Avokados',
  2: 'Antalya Apaches',
  3: 'Kucukesat Aspavas',
  4: 'Aachen ShowManners',
  5: 'Sariyer Wolfpack',
  6: 'Eryaman Lakers',
}
const nameOf = (id: number) => NAMES[id]
const colours = new Map<number, string>()

// Week 5: you 5–4 Aachen (within one), Los Avokados 4–5 Antalya (within one), Sariyer 3–5–1 Eryaman.
const MINE: OverviewMatchup = { home: side(3, 5, 4, 0, 'WWWWWLLLL'), away: side(4, 4, 5, 0, 'LLLLLWWWW') }
const CLOSE: OverviewMatchup = { home: side(1, 4, 5, 0, 'WWWWLLLLL'), away: side(2, 5, 4, 0, 'LLLLWWWWW') }
const TIED: OverviewMatchup = { home: side(5, 3, 5, 1, 'WWWTLLLLL'), away: side(6, 5, 3, 1, 'LLLTWWWWW') }
const NO_BOX: OverviewMatchup = { home: side(5, 0, 0), away: side(6, 0, 0) }

const rows = (props: Partial<Parameters<typeof MatchupRows>[0]> = {}) =>
  render(
    <MatchupRows
      matchups={[MINE, CLOSE, TIED]}
      sides={(m) => (m.away.team_id === 3 ? [m.away, m.home] : [m.home, m.away])}
      nameOf={nameOf}
      colours={colours}
      myTeamId={3}
      mine={MINE}
      week={{ start: '2026-11-23', end: '2026-11-29' }}
      creds={null}
      {...props}
    />,
  )

const rowOf = (name: RegExp) => screen.getByRole('button', { name })

describe('withinOne', () => {
  it('counts a one-category gap or a level score as close', () => {
    expect(withinOne(side(1, 5, 4), side(2, 4, 5))).toBe(true)
    expect(withinOne(side(1, 4, 4, 1), side(2, 4, 4, 1))).toBe(true)
    expect(withinOne(side(1, 6, 3), side(2, 3, 6))).toBe(false)
  })
})

describe('MatchupRows', () => {
  it('draws mirrored rows with the leader marked and the markers worth knowing', () => {
    const { container } = rows()
    const items = container.querySelectorAll('.lmr-item')
    expect(items).toHaveLength(3)

    const tied = items[2]
    const [a, b] = tied.querySelectorAll('.lmr-side')
    expect(a.classList.contains('lmr-a')).toBe(true)
    expect(b.classList.contains('lmr-b')).toBe(true)
    expect(b.classList.contains('lmr-lead')).toBe(true)
    expect(a.classList.contains('lmr-lead')).toBe(false)
    expect(within(tied as HTMLElement).getByText('1 tied')).toBeTruthy()
    expect(within(tied as HTMLElement).queryByText('Within one')).toBeNull()

    expect(within(items[1] as HTMLElement).getByText('Within one')).toBeTruthy()
  })

  it('lights your row and badges your crest, with no words beside the name', () => {
    const { container } = rows()
    const mine = container.querySelector('.lmr-item.mine') as HTMLElement
    expect(mine).toBeTruthy()
    expect(mine.querySelectorAll('.yourcrest > .yourcrest-me')).toHaveLength(1)
    expect(within(mine).queryByText(/your matchup/i)).toBeNull()
    expect(rowOf(/^Your matchup: Kucukesat Aspavas 5, Aachen ShowManners 4/)).toBeTruthy()
    expect(container.querySelectorAll('.lmr-item:not(.mine) .yourcrest-me')).toHaveLength(0)
  })

  it('has no matchup of the week marker: the sheet above names the featured matchup', () => {
    rows()
    expect(screen.queryByText('Matchup of the week')).toBeNull()
    cleanup()
    rows({ myTeamId: null, mine: undefined })
    expect(screen.queryByText('Matchup of the week')).toBeNull()
    expect(rowOf(/^Sariyer Wolfpack 3, Eryaman Lakers 5, 1 tied$/)).toBeTruthy()
  })

  it('opens the box score right under its row and closes it again', () => {
    const { container } = rows()
    const row = rowOf(/^Los Avokados 4, Antalya Apaches 5/)
    expect(row.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')

    const box = screen.getByRole('region', { name: 'Los Avokados vs Antalya Apaches' })
    expect(row.closest('.lmr-item')?.contains(box)).toBe(true)
    expect(row.getAttribute('aria-controls')).toBe(box.id)
    expect(container.querySelectorAll('.lmr-box')).toHaveLength(1)

    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('keeps one box open at a time', () => {
    rows()
    fireEvent.click(rowOf(/^Los Avokados/))
    fireEvent.click(rowOf(/^Your matchup/))
    const boxes = screen.getAllByRole('region')
    expect(boxes).toHaveLength(1)
    expect(boxes[0].getAttribute('aria-label')).toBe('Kucukesat Aspavas vs Aachen ShowManners')
  })

  it('moves focus into the box from the keyboard and back to the row on close', () => {
    rows()
    const row = rowOf(/^Los Avokados/)
    fireEvent.click(row, { detail: 0 })
    const box = screen.getByRole('region')
    expect(document.activeElement).toBe(box)
    fireEvent.click(within(box).getByRole('button', { name: 'Close matchup' }))
    expect(screen.queryByRole('region')).toBeNull()
    expect(document.activeElement).toBe(row)
  })

  it('closes on Escape', () => {
    rows()
    fireEvent.click(rowOf(/^Los Avokados/))
    expect(screen.getByRole('region')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('leaves a row without a box score as plain text', () => {
    rows({ matchups: [NO_BOX] })
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Sariyer Wolfpack')).toBeTruthy()
  })
})

const pulse = (p: Partial<LeagueOverview['pulse']> = {}): LeagueOverview['pulse'] => ({
  faab_leader_id: 3,
  faab_leader_spent: 34,
  faab_budget: 100,
  claims_last_7_days: 13,
  trades_this_season: 1,
  close_matchups: 2,
  ...p,
})

describe('LeagueWire', () => {
  it('reads the three league facts as plain lines', () => {
    const { container } = render(<LeagueWire pulse={pulse()} nameOf={nameOf} colours={colours} myTeamId={null} />)
    const facts = [...container.querySelectorAll('.lwr-facts li')]
    expect(facts).toHaveLength(3)
    expect(facts[0].textContent).toMatch(/^\$34top FAAB spend.*Kucukesat Aspavas$/)
    expect(facts[1].textContent).toBe('13waiver claims, last 7 days')
    expect(facts[2].textContent).toBe('1trade this season')
  })

  it('badges the FAAB leader when it is your team, and says so when nobody has spent', () => {
    const { container, rerender } = render(
      <LeagueWire pulse={pulse()} nameOf={nameOf} colours={colours} myTeamId={3} />,
    )
    expect(container.querySelectorAll('.yourcrest > .yourcrest-me')).toHaveLength(1)
    rerender(
      <LeagueWire
        pulse={pulse({ faab_leader_id: null, claims_last_7_days: 1, trades_this_season: 0 })}
        nameOf={nameOf}
        colours={colours}
        myTeamId={3}
      />,
    )
    expect(screen.getByText('No FAAB spent yet')).toBeTruthy()
    expect(screen.getByText('waiver claim, last 7 days')).toBeTruthy()
    expect(screen.getByText('trades this season')).toBeTruthy()
  })
})
