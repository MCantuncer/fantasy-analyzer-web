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
  pro_locked: false,
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
      async () =>
        new Response(
          JSON.stringify(report({ team_name: 'Hammer', categories: [], pickups: [pickup(P.lopez, 0.47, 0.51)] })),
        ),
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

  it("shows the page head, then the scouted team's real best move", async () => {
    const { container, fetchMock } = renderSample()
    const view = within(container)
    expect(view.getByRole('heading', { level: 1, name: 'Sample league' })).toBeInTheDocument()
    expect(container.querySelector('.smp-meta')?.textContent).toBe(
      'A real ESPN 9-cat league, team names masked · analysed Wed, Nov 11',
    )
    // The product sentence waits inside How it works; the best move is the first thing read.
    expect(view.getByText(/finds the best move for your ESPN team/)).not.toBeVisible()
    await waitFor(() => expect(view.getAllByText("Hammer's playoff odds").length).toBeGreaterThan(0))
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/sample\/teams\/3\?day=2026-11-11$/)
    expect(view.getByText('How often Hammer wins each category')).toBeInTheDocument()
    expect(container.querySelector('.mvl-rung.me:not(.scout)')).toBeNull()
    expect(container.querySelector('.card.best .mvl-season .mvl-rung.scout')).not.toBeNull()
  })

  it('says when the run is late, and marks last season', () => {
    const late = renderSample({ fresh: false })
    expect(late.container.querySelector('.smp-meta')?.textContent).toBe(
      "A real ESPN 9-cat league, team names masked · analysed Wed, Nov 11 · today's run is late",
    )
    late.unmount()
    const old = renderSample({ phase: 'offseason', analysed_on: '2026-04-06' })
    expect(old.container.querySelector('.smp-meta')?.textContent).toBe(
      'A real ESPN 9-cat league, team names masked · from Mon, Apr 6, last season',
    )
    expect(within(old.container).getByText('New moves start once the season tips off.')).toBeInTheDocument()
  })

  it('opens and closes How it works', () => {
    const { container } = renderSample()
    const view = within(container)
    const toggle = view.getByRole('button', { name: 'How it works' })
    const panel = container.querySelector('.smp-how')!
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', panel.id)
    expect(panel).not.toBeVisible()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    expect(panel.textContent).toMatch(/^COURT finds the best move .* Pick any team below to scout its move\.$/)
    fireEvent.click(toggle)
    expect(panel).not.toBeVisible()
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

  it('shows the playoff line as a seam after the last team in, with no explainer line', () => {
    const { container } = renderSample()
    const scout = container.querySelector('.smp-scout')!
    expect(scout).not.toHaveClass('card')
    expect(scout.textContent).not.toMatch(/Every team here|make the playoffs/)
    // playoff_teams is 2: the seam follows the 2nd team, labelled once.
    const items = [...container.querySelectorAll('.smp-ladder > li')]
    expect(
      items.map((li) => (li.classList.contains('smp-seam') ? '|' : li.querySelector('.smp-team-name')?.textContent)),
    ).toEqual(['Spain', 'Zipper', '|', 'Floppy', 'Hammer', 'Stagger'])
    expect(container.querySelector('.smp-seam')).toHaveTextContent('Playoff line')
    expect(
      within(container).getByRole('button', { name: /^Scout Zipper, projected 2nd, last playoff spot/ }),
    ).toBeInTheDocument()
    // No green dot on "Has a move".
    expect(container.querySelector('.smp-move-dot')).toBeNull()
  })

  it('puts the best move full width, then the categories, then the scout list', () => {
    const { container } = renderSample()
    expect(container.querySelector('.smp .split')).toBeNull()
    const order = [...container.querySelectorAll('.smp > *')].map((n) => n.className)
    expect(order.findIndex((c) => c.includes('smp-best'))).toBeLessThan(order.findIndex((c) => c.includes('smp-scout')))
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
