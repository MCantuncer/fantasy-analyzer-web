import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TeamBuild } from '../api/client'
import { Builds } from './Builds'

afterEach(cleanup)

// ESPN's own column order, as report.league.categories sends it; the strip re-sorts it.
const ESPN = ['FT%', 'REB', 'PTS', 'BLK', '3PM', 'STL', 'TO', 'AST', 'FG%']
const ORDER = ['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS']
const ranks = (xs: number[]) => Object.fromEntries(ORDER.map((c, i) => [c, xs[i]]))
const build = (team_id: number, team_name: string, r: number[], weak: string[], cats: number): TeamBuild =>
  ({ team_id, team_name, ranks: ranks(r), strong: [], weak, expected_cats_won: cats }) as unknown as TeamBuild

const BUILDS = [
  build(3, 'Kucukesat Aspavas', [1, 10, 9, 5, 7, 10, 5, 1, 9], ['FT%', '3PM', 'STL', 'PTS'], 4.29),
  build(11, "Jze's Scary Team", [7, 6, 1, 1, 10, 2, 1, 3, 6], ['AST'], 5.21),
  build(5, 'Antalya Apaches', [3, 3, 7, 8, 5, 8, 6, 7, 8], [], 4.28),
]

describe('Builds', () => {
  it('ranks teams by cats a week, yours lit with the badge on its crest', () => {
    render(<Builds builds={BUILDS} categories={ESPN} myTeamId={3} />)
    const names = [...document.querySelectorAll('.bd-r .bd-nm')].map((n) => n.textContent)
    expect(names).toEqual(["Jze's Scary Team", 'Kucukesat Aspavas', 'Antalya Apaches'])
    const mine = document.querySelector('.bd-r.mine')!
    expect(mine.querySelector('.bd-nm')!.textContent).toBe('Kucukesat Aspavas')
    expect(mine.querySelector('.yc > .yc-me')).toBeTruthy()
    expect(document.querySelectorAll('.yc-me')).toHaveLength(1)
  })

  it("draws each team's nine ranks in the site's category order, punts and top two called out", () => {
    render(<Builds builds={BUILDS} categories={ESPN} myTeamId={3} />)
    const strip = screen.getByRole('list', { name: 'Kucukesat Aspavas: weekly rank in each category' })
    const items = within(strip).getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('aria-label'))).toEqual([
      'FG% rank 1, top two',
      'FT% rank 10, likely punt',
      '3PM rank 9, likely punt',
      'REB rank 5',
      'AST rank 7',
      'STL rank 10, likely punt',
      'BLK rank 5',
      'TO rank 1, top two',
      'PTS rank 9, likely punt',
    ])
    expect(strip.querySelectorAll('.cs-good')).toHaveLength(2)
    expect(strip.querySelectorAll('.cs-bad')).toHaveLength(4)
    expect(strip.querySelector('.cs-rup')).toBeTruthy()
    expect(document.querySelector('.heat')).toBeNull()
  })

  it('says the likely punts in words, and nothing for a team without one', () => {
    render(<Builds builds={BUILDS} categories={ESPN} myTeamId={3} />)
    expect(document.querySelector('.bd-r.mine .bd-pu')!.textContent).toBe('Punts FT% · 3PM · STL · PTS')
    const none = [...document.querySelectorAll('.bd-r')].find((r) => r.textContent!.includes('Antalya'))!
    expect(none.querySelector('.bd-pu')!.classList.contains('bd-none')).toBe(true)
    expect(none.querySelector('.bd-cw')!.textContent).toBe('4.28 cats a week')
  })
})
