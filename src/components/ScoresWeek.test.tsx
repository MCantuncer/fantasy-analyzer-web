import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FixtureDay } from '../api/client'
import { usToday } from '../lib/scores'
import { ScoresWeek } from './ScoresWeek'

afterEach(cleanup)

const day = (n: number, date: string, sits: number[] = []): FixtureDay => ({
  day: n,
  date,
  sits,
  games: [
    {
      id: n,
      start: `${date}T23:00:00Z`,
      away: { pro_team_id: 2, abbrev: 'BOS', name: 'Boston Celtics', score: null },
      home: { pro_team_id: 9, abbrev: 'GS', name: 'Golden State Warriors', score: null },
      my_players: [{ player_id: 1, name: 'Jayson Tatum', injury_status: 'ACTIVE', pro_team_id: 2 }],
    },
  ],
})

describe('ScoresWeek', () => {
  it('leaves out the sits legend when nobody sits', () => {
    render(<ScoresWeek week={[day(1, '2026-11-22')]} onPick={() => {}} />)
    const week = screen.getByRole('region', { name: 'Still to play this week' })
    expect(week).toHaveTextContent('1 start left')
    expect(week).not.toHaveTextContent('sits:')
    expect(week.querySelector('.card')).toBeNull()
    expect(
      within(week).getByRole('rowheader', { name: 'J. Tatum' }).parentElement!.querySelector('.sw-op'),
    ).toHaveTextContent('@GS')
  })

  it('shows the legend once someone sits', () => {
    render(<ScoresWeek week={[day(1, '2026-11-22', [1])]} onPick={() => {}} />)
    expect(screen.getByRole('region', { name: 'Still to play this week' })).toHaveTextContent(
      'sits: more games that day than your lineup spots',
    )
  })

  it("marks today's column with the gold dot and picks a day from its header", () => {
    const onPick = vi.fn()
    const { container } = render(<ScoresWeek week={[day(4, usToday()), day(5, '2099-01-02')]} onPick={onPick} />)
    expect(container.querySelectorAll('.sw-today')).toHaveLength(1)
    const today = screen.getByRole('button', { name: /, today$/ })
    expect(today.querySelector('.sw-today')).not.toBeNull()
    fireEvent.click(today)
    expect(onPick).toHaveBeenCalledWith(4)
  })
})
