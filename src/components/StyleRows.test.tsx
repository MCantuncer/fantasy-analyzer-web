import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ManagerStyles } from '../api/client'
import fixture from '../lib/managerStyles.fixture.json'
import { StyleRows } from './StyleRows'

afterEach(cleanup)

const data = fixture as unknown as ManagerStyles
const order = data.teams.map((t) => t.team_id)

describe('StyleRows', () => {
  it('lists every manager with their labels as chips', () => {
    render(<StyleRows data={data} order={order} colours={new Map()} myTeamId={3} opponentId={10} />)
    const rows = within(screen.getByRole('list', { name: 'How each manager plays' })).getAllByRole('listitem')
    expect(rows).toHaveLength(data.teams.length)
    const mine = rows.find((r) => r.classList.contains('mine'))!
    expect(within(mine).getByRole('button', { name: 'Waiver hawk' })).toBeTruthy()
    expect(within(mine).getByText(/· You/)).toBeTruthy()
    expect(rows.find((r) => r.classList.contains('rival'))!.textContent).toContain('this week')
  })

  it('shows a closed door only where it means something', () => {
    render(<StyleRows data={data} order={order} colours={new Map()} myTeamId={3} opponentId={10} />)
    const closed = data.teams.filter((t) => t.door === 'closed')
    expect(screen.queryAllByRole('button', { name: /Door closed/ })).toHaveLength(closed.length)
    expect(screen.queryByText('Door unknown')).toBeNull()
  })

  it('opens one readout at a time with the number against the median', () => {
    render(<StyleRows data={data} order={order} colours={new Map()} myTeamId={3} opponentId={10} />)
    const mine = document.querySelector('.sr-row.mine') as HTMLElement
    const hawk = within(mine).getByRole('button', { name: 'Waiver hawk' })
    fireEvent.click(hawk)
    expect(hawk.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/adds\/wk · median/).textContent).toContain('+2.3')
    const wins = screen.getAllByRole('button', { name: /^Wins/ })[0]
    fireEvent.click(wins)
    expect(hawk.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1)
  })
})
