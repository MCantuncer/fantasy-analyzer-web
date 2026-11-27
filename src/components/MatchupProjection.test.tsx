import { cleanup, render, screen, within } from '@testing-library/react'
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
  it('names the winner of the week and draws who takes each category as a bar, in the site order', () => {
    render(<ProjectionView data={data()} me={me} them={opp} />)
    expect(screen.getByRole('heading', { name: 'Projected final' })).toBeInTheDocument()
    expect(screen.getByText('You win')).toBeInTheDocument()
    expect(screen.getByText('6–3')).toBeInTheDocument()
    const strip = screen.getByRole('list', { name: 'Projected final: you win 6–3, by category' })
    const items = within(strip).getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('aria-label')!.split(':')[0])).toEqual([
      'FG%',
      'FT%',
      '3PM',
      'REB',
      'AST',
      'STL',
      'BLK',
      'TO',
      'PTS',
    ])
    expect(items[1].getAttribute('aria-label')).toBe(
      'FT%: you .500, Kavaklidere Boytoys .450, Kavaklidere Boytoys take it',
    )
    expect(items[7].getAttribute('aria-label')).toBe('TO: you 100, Kavaklidere Boytoys 90, Kavaklidere Boytoys take it')
    // One bar in every column (up and blue for you, down and orange for them), no crests; the winner's figure in ink.
    expect(strip.querySelectorAll('.cs-kc .crest')).toHaveLength(0)
    expect(strip.querySelectorAll('.cs-km-me')).toHaveLength(6)
    expect(strip.querySelectorAll('.cs-km-them')).toHaveLength(3)
    expect(items[1].querySelector('.cs-km')).toHaveClass('cs-km-them')
    expect(items[0].querySelector('.cs-w')!.textContent).toBe('.500')
    // No close mark here: that one belongs to the strip above.
    expect(strip.querySelector('.cs-close, .cs-close-word')).toBeNull()
    expect(items[7].querySelector('.cs-pl')!.textContent).toBe('TO↓')
  })

  it('says when the opponent is projected to win', () => {
    render(<ProjectionView data={data({ wins: 4, losses: 5 })} me={me} them={opp} />)
    expect(screen.getByText('Kavaklidere Boytoys win')).toBeInTheDocument()
    expect(screen.getByText('5–4')).toBeInTheDocument()
  })

  it('folds crowded days that bench the same players into one flat row', () => {
    const { container } = render(<ProjectionView data={data()} me={me} them={opp} />)
    expect(container.querySelectorAll('.proj-crowd-row')).toHaveLength(1)
    const row = container.querySelector('.proj-crowd-row')!
    expect(row.querySelector('.proj-crowd-when')?.textContent).toBe('YouMon, Nov 2 & Wed, Nov 4')
    expect(row.querySelector('.proj-crowd-count.over')?.textContent).toBe('13 playing')
    expect(screen.getByText('Davion Mitchell')).toBeInTheDocument()
    expect(screen.getByText('D. Mitchell')).toBeInTheDocument()
    expect(row.querySelectorAll('.head')).toHaveLength(3)
  })

  it('leaves out crowded days when everyone fits', () => {
    render(<ProjectionView data={data({ my_crowded: [] })} me={me} them={opp} />)
    expect(screen.queryByText('Crowded days')).not.toBeInTheDocument()
  })
})
