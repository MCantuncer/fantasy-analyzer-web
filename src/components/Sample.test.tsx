import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SampleIndex } from '../api/client'
import { P, pickup, report } from '../test/newsSince'
import { SamplePage } from './Sample'
import { SampleSwitcher } from './SampleSwitcher'

const index: SampleIndex = {
  analysed_on: '2026-11-11',
  fresh: true,
  phase: 'season',
  season: 2027,
  league: { name: 'Sample league', size: 5, scoring: 'H2H_EACH_CATEGORY', categories: [], playoff_teams: 2 },
  default_team_id: 3,
  teams: [
    { id: 3, name: 'Hammer', abbrev: 'HAM', projected_rank: 4, has_move: true },
    { id: 5, name: 'Spain', abbrev: 'SPN', projected_rank: 1, has_move: false },
    { id: 6, name: 'Zipper', abbrev: 'ZIP', projected_rank: 2, has_move: true },
    { id: 7, name: 'Floppy', abbrev: 'FLP', projected_rank: 3, has_move: false },
    { id: 8, name: 'Stagger', abbrev: 'STG', projected_rank: 5, has_move: false },
  ],
}

function renderSample(over: Partial<SampleIndex> = {}) {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(
      async () => new Response(JSON.stringify(report({ team_name: 'Hammer', categories: [], pickups: [pickup(P.lopez, 0.47, 0.51)] }))),
    )
  const onScout = vi.fn()
  const onJoin = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const sample = { ...index, ...over }
  const view = render(
    <QueryClientProvider client={client}>
      <SamplePage index={sample} scout={sample.teams[0]} onScout={onScout} onJoin={onJoin} />
    </QueryClientProvider>,
  )
  return { ...view, fetchMock, onScout, onJoin }
}

describe('SamplePage', () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows the scouted team's real best move under one sentence and a dated data line", async () => {
    const { container, fetchMock } = renderSample()
    const view = within(container)
    expect(view.getByText(/finds the best move for your ESPN team/)).toBeInTheDocument()
    expect(container.querySelector('.smp-data')?.textContent).toContain(
      'Below: a real ESPN 9-cat league, team names masked. Analysed Wed, Nov 11.',
    )
    await waitFor(() => expect(view.getAllByText("Hammer's playoff odds").length).toBeGreaterThan(0))
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/sample\/teams\/3\?day=2026-11-11$/)
    expect(view.getByText('How often Hammer wins each category')).toBeInTheDocument()
    expect(container.querySelector('.ol-rung.me')).toBeNull()
  })

  it('says when the run is late, and marks last season', () => {
    const late = renderSample({ fresh: false })
    expect(late.container.querySelector('.smp-data')?.textContent).toContain("Today's run is late.")
    late.unmount()
    const old = renderSample({ phase: 'offseason', analysed_on: '2026-04-06' })
    expect(old.container.querySelector('.smp-data')?.textContent).toContain('From Mon, Apr 6, last season.')
  })

  it('lists every team by projected finish and scouts the one picked', () => {
    const { container, onScout } = renderSample()
    const view = within(container)
    const rows = [...container.querySelectorAll('.smp-ladder .smp-team-name')].map((n) => n.textContent)
    expect(rows).toEqual(['Spain', 'Zipper', 'Floppy', 'Hammer', 'Stagger'])
    expect(view.getByRole('button', { name: 'Scout Hammer, projected 4th, scouting now' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    fireEvent.click(view.getByRole('button', { name: 'Scout Floppy, projected 3rd, no move today' }))
    expect(onScout).toHaveBeenCalledWith(7)
  })

  it('opens sign-up from the card and from Your team', async () => {
    const { container, onJoin } = renderSample()
    const view = within(container)
    fireEvent.click(await view.findByRole('button', { name: /Get my best move/ }))
    fireEvent.click(view.getByRole('button', { name: /Your team/ }))
    fireEvent.click(view.getByRole('button', { name: 'My league: get your own best move' }))
    expect(onJoin).toHaveBeenCalledTimes(3)
    expect(view.queryByText('Make the claim on ESPN')).toBeNull()
  })
})

describe('SampleSwitcher', () => {
  it('names the sample and the scouted team, and offers your own league and sign-in', () => {
    const onScout = vi.fn()
    const onJoin = vi.fn()
    const onSignIn = vi.fn()
    const { container } = render(
      <SampleSwitcher index={index} scout={index.teams[0]} onScout={onScout} onJoin={onJoin} onSignIn={onSignIn} />,
    )
    const view = within(container)
    expect(container.querySelector('summary')?.getAttribute('aria-label')).toBe(
      'Sample league, team names masked. Scouting Hammer. Scout another team',
    )
    fireEvent.click(view.getByRole('button', { name: /Zipper/ }))
    fireEvent.click(view.getByRole('button', { name: 'Analyze my own league' }))
    fireEvent.click(view.getByRole('button', { name: 'Sign in' }))
    expect(onScout).toHaveBeenCalledWith(6)
    expect(onJoin).toHaveBeenCalled()
    expect(onSignIn).toHaveBeenCalled()
  })
})
