import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { report } from '../test/newsSince'
import { Report } from './Report'

// Moves' own parts are tested on their own; here only their order on the page matters.
vi.mock('./BestMove', () => ({
  BestMove: ({ foot }: { foot?: ReactNode }) => <div data-part="best">{foot}</div>,
}))
vi.mock('./Outlook', () => ({ SeasonBand: () => <div data-part="season" /> }))
vi.mock('./CategoryTiles', () => ({
  CategoryTiles: () => <div data-part="categories" />,
}))
vi.mock('./Trades', () => ({ Trades: () => <section data-part="trades" /> }))
vi.mock('./Pickups', () => ({ Pickups: () => <section data-part="fa" /> }))
vi.mock('./TradeOfTheDay', () => ({
  TradeOfTheDay: () => <div data-part="totd" />,
}))
vi.mock('../lib/useManagerStyles', () => ({
  useManagerStyles: () => ({ data: undefined }),
}))

afterEach(cleanup)

function renderMoves() {
  const base = report({})
  const r = {
    ...base,
    league: {
      ...base.league,
      name: 'Chill Primera Division',
      teams: [],
      categories: [],
    },
    categories: [],
    assumptions: {
      simulations: 1000,
      games_per_week: 3.5,
      scoring_type: 'H2H_CATEGORY',
      notes: [],
    },
    elapsed_ms: 1000,
  } as typeof base
  return render(
    <Report
      report={r}
      tab="moves"
      keep={[]}
      keepChanged={false}
      onToggleKeep={() => {}}
      onRerun={() => {}}
      rerunning={false}
      creds={null}
      overview={null}
      onTab={() => {}}
    />,
  )
}

describe('Moves page order', () => {
  it('reads the lead with its season band, categories, the two lists, then Trade of the day', () => {
    const { container } = renderMoves()
    const parts = [...container.querySelectorAll('[data-part]')].map((el) => el.getAttribute('data-part'))
    expect(parts).toEqual(['best', 'season', 'categories', 'trades', 'fa', 'totd'])
  })

  it('folds the season outlook into the lead, with no card of its own', () => {
    const { container } = renderMoves()
    expect(container.querySelector('#moves-best [data-part="best"] [data-part="season"]')).not.toBeNull()
    expect(container.querySelector('.mv-lead, .split')).toBeNull()
  })

  it('shows both lists at once, with no Trades / FA Targets switch', () => {
    const { container } = renderMoves()
    expect(container.querySelector('.moves-switch')).toBeNull()
    expect(container.querySelector('.mv-lists .mv-trades [data-part="trades"]')).not.toBeNull()
    expect(container.querySelector('.mv-lists .mv-fa [data-part="fa"]')).not.toBeNull()
  })
})
