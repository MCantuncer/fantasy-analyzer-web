import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PickupIdea } from '../api/client'
import { Pickups } from './Pickups'

const ref = (id: number, name: string) =>
  ({ id, name, positions: ['SF'], percent_owned: 40, injury_status: 'ACTIVE' }) as PickupIdea['add']

const pickup = {
  add: ref(1, 'Miles Bridges'),
  drop: ref(2, 'Aaron Wiggins'),
  open_spot_by_trade: false,
  availability: 'WAIVERS',
  playoff_pct_before: 0.14,
  playoff_pct_after: 0.2,
  category_changes: {},
} as unknown as PickupIdea

describe('Pickups waiver priority', () => {
  it('shows your place in the waiver order in leagues without FAAB', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={null} waiverPriority={2} teams={12} />)
    const view = within(container)
    expect(view.getByText('Waiver priority 2nd of 12')).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { expanded: false }))
    expect(view.getByText(/A claim uses your waiver priority \(2nd\)/)).toBeInTheDocument()
  })

  it('shows FAAB instead when the league bids', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={98} waiverPriority={null} teams={10} />)
    const view = within(container)
    expect(container.querySelector('.fa-faab')?.textContent).toBe('$98 FAAB left')
    expect(view.queryByText(/Waiver priority/)).toBeNull()
  })
})

describe('Pickups shared drop', () => {
  it('names a drop shared by every idea once, above the list', () => {
    const other = { ...pickup, add: ref(3, 'Neemias Queta'), playoff_pct_after: 0.18 } as PickupIdea
    const { container } = render(<Pickups pickups={[pickup, other]} faab={50} />)
    const view = within(container)
    expect(view.getByText(/Each one replaces/)).toBeInTheDocument()
    expect(view.getAllByText('Aaron Wiggins')).toHaveLength(1)
    expect(view.getByText('from 14%')).toBeInTheDocument()
  })

  it('keeps the drop on each row when the drops differ', () => {
    const other = { ...pickup, add: ref(3, 'Neemias Queta'), drop: ref(4, 'Kris Dunn') } as PickupIdea
    const { container } = render(<Pickups pickups={[pickup, other]} faab={50} />)
    const view = within(container)
    expect(view.queryByText(/Each one replaces/)).toBeNull()
    expect(view.getByText('Kris Dunn')).toBeInTheDocument()
  })
})

describe('Pickups timing', () => {
  const day = (date: string, add: boolean, drop: boolean) => ({ date, add_plays: add, drop_plays: drop })
  const waiting = {
    ...pickup,
    add: ref(3, 'Brook Lopez'),
    drop: ref(4, 'Georges Niang'),
    availability: 'FREEAGENT',
    timing: {
      wait: true,
      make_on: '2026-11-08',
      next_week: false,
      earliest_on: '2026-11-05',
      cats_now: -0.02,
      cats_best: 0.1,
      drop_games_kept: 2,
      add_games_missed: 0,
      week_changes: {},
      days: [
        day('2026-11-05', false, true),
        day('2026-11-06', false, false),
        day('2026-11-07', false, true),
        day('2026-11-08', true, false),
      ],
    },
  } as unknown as PickupIdea
  const week = {
    opponent_team_id: 4,
    opponent_name: 'Kavaklidere',
    adds_used: 2,
    adds_allowed: 5,
    close_categories: [],
  }

  it('says when waiting pays, with the games it keeps', () => {
    const { container } = render(<Pickups pickups={[waiting]} faab={50} week={week} />)
    const when = container.querySelector('.fa-when')
    expect(when?.textContent).toContain('Make this Sunday')
    expect(when?.textContent).toContain('+2 games')
    expect(when?.textContent).toContain('Niang plays Thursday and Saturday first, 3 games in the spot instead of 1')
  })

  it('shows adds left this week in the header', () => {
    const { container } = render(<Pickups pickups={[pickup]} faab={50} week={week} />)
    expect(container.querySelector('.fa-adds')?.textContent).toBe('3 of 5 adds left')
    expect(container.querySelector('.fa-when')).toBeNull()
  })
})

describe('Pickups fold', () => {
  const many = Array.from(
    { length: 7 },
    (_, i) => ({ ...pickup, add: ref(10 + i, `Free Agent ${i + 1}`) }) as PickupIdea,
  )

  it('opens on the best five and shows the rest on request', () => {
    const { container } = render(<Pickups pickups={many} faab={50} />)
    const view = within(container)
    expect(container.querySelectorAll('.move')).toHaveLength(5)
    expect(view.queryByText('Free Agent 6')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Show all 7' }))
    expect(container.querySelectorAll('.move')).toHaveLength(7)
    expect(view.getByText('Free Agent 7')).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Show top 5' }))
    expect(container.querySelectorAll('.move')).toHaveLength(5)
  })

  it('has no fold when five or fewer ideas fit as they are', () => {
    const { container } = render(<Pickups pickups={many.slice(0, 5)} faab={50} />)
    expect(container.querySelectorAll('.move')).toHaveLength(5)
    expect(within(container).queryByRole('button', { name: /Show all/ })).toBeNull()
  })

  it('names a drop once when the rows in view share it, even if a folded row differs', () => {
    const odd = { ...pickup, add: ref(30, 'Odd One'), drop: ref(31, 'Kris Dunn') } as PickupIdea
    const { container } = render(<Pickups pickups={[...many.slice(0, 5), odd]} faab={50} />)
    const view = within(container)
    expect(view.getByText(/Each one replaces/)).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Show all 6' }))
    expect(view.queryByText(/Each one replaces/)).toBeNull()
    expect(view.getByText('Kris Dunn')).toBeInTheDocument()
  })
})
