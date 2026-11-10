import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { MatchupProjection } from '../api/client'
import { ProjectionView } from './MatchupProjection'

afterEach(cleanup)

const STATS = ['FT%', 'REB', 'PTS', 'BLK', '3PM', 'STL', 'TO', 'AST', 'FG%']
const THEIRS = new Set(['FT%', '3PM', 'TO'])
const BENCH = [
  { id: 1, name: 'Davion Mitchell' },
  { id: 2, name: 'Kyshawn George' },
  { id: 3, name: 'Isaiah Jackson' },
]

function data(over: Partial<MatchupProjection> = {}): MatchupProjection {
  return {
    opponent_id: 4,
    wins: 6,
    losses: 3,
    categories: STATS.map((stat) => ({
      stat,
      mine: stat.endsWith('%') ? 0.5 : 100,
      theirs: stat.endsWith('%') ? 0.45 : 90,
      winner: THEIRS.has(stat) ? 'them' : 'me',
      close: stat === 'TO',
    })),
    my_crowded: [
      { date: '2026-11-02', playing: 13, slots: 10, sit: BENCH },
      { date: '2026-11-04', playing: 13, slots: 10, sit: BENCH },
    ],
    their_crowded: [],
    ...over,
  }
}

const me = { name: 'Kucukesat Aspavas', colour: undefined }
const opp = { name: 'Kavaklidere Boytoys', colour: undefined }

describe('projected final', () => {
  it('names the winner of the week and of each category, in box score order', () => {
    const { container } = render(<ProjectionView data={data()} me={me} them={opp} />)
    expect(screen.getByText('You win')).toBeInTheDocument()
    expect(screen.getByText('6-3')).toBeInTheDocument()
    const stats = [...container.querySelectorAll('.proj-stat')].map((n) => n.textContent)
    expect(stats).toEqual(['FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PTS'])
    expect(container.querySelector('.proj-cat.close .proj-stat')?.textContent).toBe('TO')
    expect(screen.getByText('Kavaklidere Boytoys, close')).toBeInTheDocument()
  })

  it('says when the opponent is projected to win', () => {
    render(<ProjectionView data={data({ wins: 4, losses: 5 })} me={me} them={opp} />)
    expect(screen.getByText('Kavaklidere Boytoys win')).toBeInTheDocument()
    expect(screen.getByText('5-4')).toBeInTheDocument()
  })

  it('folds crowded days that bench the same players into one row', () => {
    const { container } = render(<ProjectionView data={data()} me={me} them={opp} />)
    expect(container.querySelectorAll('.proj-crowd-row')).toHaveLength(1)
    const row = container.querySelector('.proj-crowd-row')!
    expect(row.querySelector('.proj-crowd-when')?.textContent).toBe('YouMon, Nov 2 & Wed, Nov 4')
    expect(row.querySelector('.proj-crowd-count.over')?.textContent).toBe('13 playing')
    expect(screen.getByText('Davion Mitchell')).toBeInTheDocument()
    expect(screen.getByText('D. Mitchell')).toBeInTheDocument()
  })

  it('leaves out crowded days when everyone fits', () => {
    render(<ProjectionView data={data({ my_crowded: [] })} me={me} them={opp} />)
    expect(screen.queryByText('Crowded days')).not.toBeInTheDocument()
  })
})
