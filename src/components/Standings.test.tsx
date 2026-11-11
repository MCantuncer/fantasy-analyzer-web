import { fireEvent, render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OverviewTeam } from '../api/client'
import { Standings } from './Standings'

const team = (id: number, name: string, seed: number) =>
  ({ id, name, seed, wins: 10 - seed, losses: seed, ties: 0, games_back: seed }) as unknown as OverviewTeam

const teams = [team(3, 'Kucukesat Aspavas', 1), team(9, 'Aliaga Hermanos', 2)]

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
    expect(container.querySelector('.st-trade')).toBeNull()
  })
})
