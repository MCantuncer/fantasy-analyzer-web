import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PlayerRef } from '../api/client'
import { RoundValuesContext } from '../lib/tradeValue'
import { Roster } from './Roster'

const player = {
  id: 1,
  name: 'Jalen Green',
  pro_team: 'PHX',
  positions: ['SG'],
  injury_status: 'ACTIVE',
  percent_owned: 90,
  value: 1.2,
  perceived_value: 25,
  tier: 'tradeable',
  injury_prone: false,
  badges: [],
  owner_premium: 0,
} as PlayerRef

const out = {
  ...player,
  id: 2,
  name: 'Aday Mara',
  positions: ['C'],
  injury_status: 'OUT',
  value: -3.8,
  perceived_value: 2,
  tier: 'injured',
} as PlayerRef

const drop = {
  ...player,
  id: 3,
  name: 'Daniel Gafford',
  positions: ['C'],
  value: -2.4,
  perceived_value: 3,
  tier: 'droppable',
} as PlayerRef

describe('Roster trade value', () => {
  it('shows auction dollars by default', () => {
    const { container } = render(<Roster roster={[player]} keep={[]} onToggleKeep={() => {}} />)
    expect(within(container).getByText('$25')).toBeInTheDocument()
  })

  it('shows the draft round in snake leagues', () => {
    const { container } = render(
      <RoundValuesContext.Provider value={[50, 32, 20, 12]}>
        <Roster roster={[player]} keep={[]} onToggleKeep={() => {}} />
      </RoundValuesContext.Provider>,
    )
    expect(within(container).getByText('Rd 3')).toBeInTheDocument()
    expect(within(container).queryByText('$25')).toBeNull()
  })
})

describe('Roster quiet rows', () => {
  it('is one list of rows: no table, no checkboxes, a bare lock with aria-pressed', () => {
    const toggled: number[] = []
    const { container } = render(<Roster roster={[player]} keep={[]} onToggleKeep={(id) => toggled.push(id)} />)
    expect(container.querySelector('table, input[type="checkbox"]')).toBeNull()
    const keep = within(container).getByRole('button', { name: 'Keep Jalen Green' })
    expect(keep).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(keep)
    expect(toggled).toEqual([1])
  })

  it('shows status only when it is not the default', () => {
    const { container } = render(<Roster roster={[player, out, drop]} keep={[]} onToggleKeep={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/Tradeable|Injured/)
    expect(container.querySelectorAll('.ro-tag')).toHaveLength(1)
    expect(container.querySelector('.ro-tag')).toHaveTextContent('OUT')
    expect(within(container).getByText('· Droppable')).toBeInTheDocument()
  })

  it('signs the cat value with a real minus and colours it by outcome', () => {
    const { container } = render(<Roster roster={[player, out]} keep={[]} onToggleKeep={() => {}} />)
    const cats = [...container.querySelectorAll('.ro-cvd')]
    expect(cats.map((c) => c.textContent)).toEqual([', category value +1.2', ', category value −3.8'])
    expect(cats[0]).toHaveClass('ro-pos')
    expect(cats[1]).toHaveClass('ro-neg')
  })

  it('every row has a face and the name', () => {
    const { container } = render(<Roster roster={[player, out, drop]} keep={[]} onToggleKeep={() => {}} />)
    const rows = container.querySelectorAll('.ro-row')
    expect(rows).toHaveLength(3)
    rows.forEach((r) => expect(r.querySelector('.head')).not.toBeNull())
    expect(within(container).getByText('Aday Mara')).toBeInTheDocument()
  })

  it('names players by last name on phones, unique within the roster', () => {
    const giannis = { ...player, id: 4, name: 'Giannis Antetokounmpo' } as PlayerRef
    const { container } = render(<Roster roster={[player, giannis]} keep={[]} onToggleKeep={() => {}} />)
    expect([...container.querySelectorAll('.ro-short')].map((n) => n.textContent)).toEqual(['Green', 'Giannis'])
  })

  it('shows the Kept group only when someone is kept', () => {
    const none = render(<Roster roster={[player, out]} keep={[]} onToggleKeep={() => {}} />)
    expect(none.container.querySelector('.ro-sub')).toBeNull()
    none.unmount()
    const { container } = render(<Roster roster={[player, out]} keep={[2]} onToggleKeep={() => {}} />)
    const heads = [...container.querySelectorAll('.ro-sub')].map((h) => h.textContent)
    expect(heads).toEqual(['Kept never offered or dropped', 'Everyone else'])
    expect(within(container).getByRole('button', { name: 'Keep Aday Mara' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has a Shop button per player when shopping is on', () => {
    const shopped: number[] = []
    const { container } = render(
      <Roster roster={[player]} keep={[]} onToggleKeep={() => {}} onShop={(id) => shopped.push(id)} />,
    )
    fireEvent.click(within(container).getByRole('button', { name: 'Shop Jalen Green' }))
    expect(shopped).toEqual([1])
  })
})

describe('Roster on the team sheet', () => {
  it('puts the badges on the face corner, not loose after the name', () => {
    const hot = { ...player, badges: [{ kind: 'hot', reason: 'Hot streak' }] } as PlayerRef
    const { container } = render(<Roster roster={[hot]} keep={[]} onToggleKeep={() => {}} />)
    const corner = container.querySelector('.ro-face .ro-face-bdg')
    expect(corner).not.toBeNull()
    expect(within(corner as HTMLElement).getByRole('img', { name: /Hot/ })).toBeInTheDocument()
    expect(container.querySelector('.ro-l1 .pb-marks')).toBeNull()
    expect(container.querySelectorAll('.pb-mark')).toHaveLength(1)
  })

  it('has no card box and no hint sentence: the Keep column head carries the locks', () => {
    const { container } = render(<Roster roster={[player]} keep={[]} onToggleKeep={() => {}} />)
    expect(container.querySelector('.card')).toBeNull()
    expect(container.querySelector('.ro-hint')).toBeNull()
    expect(within(container).getByText('Keep')).toBeInTheDocument()
  })
})
