import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WeekRecap } from '../api/client'
import { teamColours } from '../lib/league'
import week2 from '../test/recap-week2.json'
import { FilmRoomPage, FilmRoomPicker } from './FilmRoom'

afterEach(cleanup)

const recap = week2 as unknown as WeekRecap
const teams = recap.teams.map((t) => ({ id: t.team_id, name: t.name }))
const ref = { leagueId: 744636428, season: 2027 }

function show(myTeamId: number | null = 3) {
  return render(
    <FilmRoomPage
      recap={recap}
      head={null}
      teams={teams}
      colours={teamColours(
        teams.map((t) => t.id),
        myTeamId,
      )}
      myTeamId={myTeamId}
      leagueRef={ref}
    />,
  )
}

describe('Film Room', () => {
  it('opens on your tape: result, score and all nine categories', () => {
    const { container } = show()
    expect(screen.getByRole('heading', { level: 1, name: 'Week 2 Film Room' })).toBeInTheDocument()
    expect(screen.getByText('Oct 26 – Nov 1 · Final · 10 teams')).toBeInTheDocument()
    const tape = screen.getByRole('region', { name: 'Your tape' })
    expect(within(tape).getByText(/Won/)).toBeInTheDocument()
    expect([...container.querySelectorAll('.fr-cl')].map((n) => n.textContent)).toEqual([
      'PTS', 'FG%', 'FT%', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO',
    ])
  })

  it('hands out three game balls: player, team and pickup', () => {
    const { container } = show()
    const labels = [...container.querySelectorAll('.fr-tile-lab')].map((n) => n.textContent)
    expect(labels).toEqual(['Player', 'Team', 'Pickup'])
    expect(container.querySelector('.fr-tile-name')?.textContent).toBe('Victor Wembanyama')
  })

  it('shows still-free standouts first and who grabbed the rest', () => {
    show()
    expect(screen.getAllByText('Anfernee Simons').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Taken/ }))
    expect(screen.getAllByText('Christian Braun').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/No games for you yet/).length).toBeGreaterThan(0)
  })

  it('lists players of the week in the site stat order, top five first', () => {
    const { container } = show()
    const heads = [...container.querySelectorAll('.fr-stats thead th')].map((n) => n.textContent)
    expect(heads).toEqual(['Player', 'MIN', 'PTS', 'FG', 'FT', '3PM', 'REB', 'AST', 'STL', 'BLK', 'TO', 'Value'])
    expect(container.querySelectorAll('.fr-stats tbody tr')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10' }))
    expect(container.querySelectorAll('.fr-stats tbody tr')).toHaveLength(10)
  })

  it('leaves your tape and your week out for someone who has not verified a team', () => {
    show(null)
    expect(screen.queryByRole('region', { name: 'Your tape' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Your MVP, adds/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Final scores' })).toBeInTheDocument()
  })
})

describe('Film Room picker', () => {
  it('lists finished weeks, newest first, and opens the one picked', () => {
    const onPick = vi.fn()
    render(<FilmRoomPicker weeks={[1, 2]} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /Film Room/ }))
    const weeks = within(screen.getByRole('group', { name: 'Finished weeks' })).getAllByRole('button')
    expect(weeks.map((b) => b.textContent)).toEqual(['Week 2Last week', 'Week 12 weeks ago'])
    fireEvent.click(weeks[1])
    expect(onPick).toHaveBeenCalledWith(1)
  })

  it('stays hidden before any week is over', () => {
    const { container } = render(<FilmRoomPicker weeks={[]} onPick={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
