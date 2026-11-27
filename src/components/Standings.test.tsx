import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ManagerStyles, OverviewTeam, SeasonRow } from '../api/client'
import fixture from '../lib/managerStyles.fixture.json'
import { Standings } from './Standings'

afterEach(cleanup)

const team = (id: number, name: string, seed: number) =>
  ({ id, name, seed, wins: 10 - seed, losses: seed, ties: 0, games_back: seed - 1 }) as unknown as OverviewTeam

const teams = [team(3, 'Kucukesat Aspavas', 1), team(9, 'Aliaga Hermanos', 2)]

const league = [
  [11, "Jze's Scary Team"],
  [7, 'Los Avokados'],
  [4, 'Kavaklidere Boytoys'],
  [6, 'Çayyolu Bastards'],
  [10, 'Aachen ShowManners'],
  [3, 'Kucukesat Aspavas'],
  [9, 'Aliaga Hermanos'],
  [5, 'Antalya Apaches'],
  [1, 'Sariyer Wolfpack'],
  [8, 'Eryaman Lakers'],
] as const
const ten = league.map(([id, name], i) => team(id, name, i + 1))
const season = league.map(
  ([id, name], i) =>
    ({
      team_id: id,
      team_name: name,
      projected_wins: 97 - i * 3,
      projected_losses: 65 + i * 3,
      projected_ties: 0,
      playoff_pct: 0.96 - i * 0.08,
      first_seed_pct: i === 0 ? 0.44 : 0.01,
    }) as unknown as SeasonRow,
)

describe('Standings trade check', () => {
  it('offers a trade check with every team but yours', () => {
    const onCheckTrade = vi.fn()
    const { container } = render(
      <Standings teams={teams} colours={new Map()} myTeamId={3} playoffTeams={6} onCheckTrade={onCheckTrade} />,
    )
    const view = within(container)
    expect(view.queryByRole('button', { name: 'Check a trade with Kucukesat Aspavas' })).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Check a trade with Aliaga Hermanos' }))
    expect(onCheckTrade).toHaveBeenCalledWith(9)
  })

  it('has no trade column without a handler', () => {
    const { container } = render(<Standings teams={teams} colours={new Map()} myTeamId={3} playoffTeams={6} />)
    expect(container.querySelector('.st-tr')).toBeNull()
    expect(container.querySelector('.st-hd')).toHaveClass('st-nt')
  })
})

describe('Standings rows', () => {
  it('reads as bare rows with your row marked and the playoff line labelled after the 6th', () => {
    render(<Standings teams={ten} colours={new Map()} myTeamId={3} playoffTeams={6} onCheckTrade={() => {}} />)
    expect(screen.queryByText('Category record so far')).toBeNull()
    expect(screen.queryByText(/make the playoffs/)).toBeNull()
    const list = screen.getByRole('list', { name: 'Current standings' })
    const items = [...list.children] as HTMLElement[]
    // header, six rows, the playoff line, four rows
    expect(items).toHaveLength(12)
    expect(items[7]).toHaveAttribute('role', 'separator')
    expect(items[7]).toHaveAccessibleName('Playoff line, top 6')
    expect(items[7].textContent).toBe('Playoff line · top 6')
    const mine = list.querySelector('.st-r.mine') as HTMLElement
    expect(mine.textContent).toContain('Kucukesat Aspavas')
    expect(within(mine).getByRole('img', { name: 'your team' })).toBeTruthy()
    expect(within(mine).queryByRole('button')).toBeNull()
    expect(list.querySelectorAll('.st-r:not(.mine) .st-tr')).toHaveLength(9)
    const first = items[1]
    expect(first.querySelector('.st-rec')?.textContent).toBe('record 9–1–0')
    expect(first.querySelector('.st-pc')?.textContent).toBe('win rate .900')
  })

  it('leaves the line out when everyone makes the playoffs or there is no cut', () => {
    const { container, rerender } = render(
      <Standings teams={teams} colours={new Map()} myTeamId={3} playoffTeams={6} />,
    )
    expect(container.querySelector('.st-cut')).toBeNull()
    rerender(<Standings teams={ten} colours={new Map()} myTeamId={3} playoffTeams={null} />)
    expect(container.querySelector('.st-cut')).toBeNull()
  })

  it('shows the season simulation on Projected: odds bar, yours lit, 1st seed', () => {
    render(<Standings teams={ten} colours={new Map()} myTeamId={3} playoffTeams={6} projected={season} />)
    fireEvent.click(screen.getByRole('button', { name: 'Projected' }))
    const list = screen.getByRole('list', { name: 'Projected standings' })
    const rows = list.querySelectorAll('.st-r')
    expect(rows).toHaveLength(10)
    expect((rows[0].querySelector('.st-od i') as HTMLElement).style.getPropertyValue('--p')).toBe('96%')
    expect(rows[0].textContent).toContain('playoff odds 96%')
    expect(rows[0].textContent).toContain('first seed 44%')
    expect(rows[5]).toHaveClass('mine')
    expect(list.querySelector('.st-cut')).toBeTruthy()
  })

  it('keeps Projected pending until the analysis finishes, and hides it for followers', () => {
    const { rerender } = render(<Standings teams={ten} colours={new Map()} myTeamId={3} playoffTeams={6} />)
    fireEvent.click(screen.getByRole('button', { name: 'Projected' }))
    expect(screen.getByText(/appear here once your analysis finishes/)).toBeTruthy()
    rerender(<Standings teams={ten} colours={new Map()} myTeamId={null} playoffTeams={6} projected={null} />)
    expect(screen.queryByRole('group', { name: 'Standings view' })).toBeNull()
  })

  it('keeps the Styles view one tap away', () => {
    render(
      <Standings
        teams={ten}
        colours={new Map()}
        myTeamId={3}
        playoffTeams={6}
        projected={season}
        styles={fixture as unknown as ManagerStyles}
        opponentId={6}
      />,
    )
    const group = screen.getByRole('group', { name: 'Standings view' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Current', 'Projected', 'Styles'])
    fireEvent.click(within(group).getByRole('button', { name: 'Styles' }))
    const rows = within(screen.getByRole('list', { name: 'How each manager plays' })).getAllByRole('listitem')
    expect(rows[0].textContent).toContain("Jze's Scary Team")
    expect(rows.find((r) => r.classList.contains('mine'))?.textContent).toContain('Kucukesat Aspavas')
  })
})
