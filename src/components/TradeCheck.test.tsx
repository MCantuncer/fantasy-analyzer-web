import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisReport, OfferCheck, PlayerRef } from '../api/client'
import sample from '../test/offer-check-1for2.json'
import { TradeCheck } from './TradeCheck'
import { TradeCheckHero } from './TradeCheckHero'

const check = sample as unknown as OfferCheck
const give = check.idea.give as PlayerRef[]
const get = check.idea.get as PlayerRef[]

describe('TradeCheckHero', () => {
  it('gives the call for you first, then both teams on one grid', () => {
    const { container } = render(
      <TradeCheckHero check={check} give={give} get={get} myName="Kucukesat Aspavas" partnerName="Horns" />,
    )
    const view = within(container)
    expect(view.getByRole('status').textContent).toBe(
      'Take it. Your playoff odds 43 to 53 percent, up 10. Horns 76 to 69, down 7, worse for them, loses on paper, $10 for $17.',
    )
    expect(container.querySelector('.tck-hero-call.good')?.textContent).toBe('Take it')
    expect(view.getByText("Engine's call for you")).toBeInTheDocument()
    expect(container.querySelector('.tck-hero-row.them .tck-hero-sub')?.textContent).toBe(
      'Worse for them · $10 for $17 on paper',
    )
    expect([...container.querySelectorAll('.tck-hero-delta')].map((d) => d.textContent?.trim())).toEqual(['+10', '−7'])
    expect(view.getByText('You send')).toBeInTheDocument()
    expect(view.getByText('Bane')).toBeInTheDocument()
  })

  it('names another team in place of You, with its own buttons', () => {
    const { container } = render(
      <TradeCheckHero
        check={check}
        give={give}
        get={get}
        myName="Horns"
        partnerName="Bulls"
        meLabel="Horns"
        actions={<button type="button">Try It</button>}
      />,
    )
    const view = within(container)
    expect(view.getByText('Horns sends')).toBeInTheDocument()
    expect(view.getByText('Horns gets')).toBeInTheDocument()
    expect(view.getByRole('status').textContent).toMatch(/^Take it\. Horns playoff odds 43 to 53/)
    expect(view.getByRole('button', { name: 'Try It' })).toBeInTheDocument()
  })

  it('shows no numbers while it checks, and a retry when it fails', () => {
    const retry = vi.fn()
    const { container, rerender } = render(<TradeCheckHero give={give} get={get} myName="A" partnerName="B" loading />)
    expect(container.querySelector('.tck-hero')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.tck-hero-call.wait')?.textContent).toBe('Checking 12,000 seasons')
    expect(container.querySelector('.tck-hero-delta')).toBeNull()
    expect(container.querySelector('.tck-hero-line')).not.toBeNull()
    rerender(<TradeCheckHero give={give} get={get} myName="A" partnerName="B" error="Nope." onRetry={retry} />)
    fireEvent.click(within(container).getByRole('button', { name: 'Try Again' }))
    expect(retry).toHaveBeenCalled()
  })
})

const player = (id: number, name: string, pro_team = 'BOS') =>
  ({ id, name, pro_team, positions: ['SF'], injury_status: 'ACTIVE', badges: [] }) as unknown as PlayerRef

const report = {
  league: { id: 1, season: 2027, name: 'L' },
  team_id: 3,
  team_name: 'Kucukesat Aspavas',
  season: [{ team_id: 3 }, { team_id: 9 }],
  roster: [player(1, 'Jarrett Allen'), player(2, 'Payton Pritchard')],
  league_rosters: [
    {
      team_id: 9,
      team_name: 'Aliaga Hermanos',
      players: [player(11, 'Josh Giddey'), player(12, 'Dyson Daniels')].map((p) => ({ player: p, my_cats_gain: 0 })),
    },
  ],
} as unknown as AnalysisReport

function renderCheck(search: string) {
  window.history.replaceState(null, '', search)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TradeCheck report={report} keep={[]} creds={null} />
    </QueryClientProvider>,
  )
}

describe('TradeCheck picker (phone)', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('picks both sides, warns about the forced cut and keeps the deal in the URL', () => {
    const { container } = renderCheck('/?tab=park&check=t9')
    const view = within(container)
    const go = view.getByRole('button', { name: /Check the Deal/ })
    expect(go).toBeDisabled()
    fireEvent.click(view.getByRole('button', { name: /^Jarrett Allen/ }))
    fireEvent.click(view.getByRole('button', { name: /^Josh Giddey/ }))
    fireEvent.click(view.getByRole('button', { name: /^Dyson Daniels/ }))
    expect(view.getByRole('button', { name: /^Josh Giddey/ })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getByText(/\+1 cut\./)).toBeInTheDocument()
    expect(go).toBeEnabled()
    expect(new URLSearchParams(window.location.search).get('check')).toBe('t9.g1.r11-12')
  })

  it('drops players who have moved since the link was made, and waits to check', () => {
    const { container } = renderCheck('/?tab=park&check=t9.g1-77.r11')
    const view = within(container)
    expect(view.getByText(/A player from this link has moved since/)).toBeInTheDocument()
    expect(view.getByRole('button', { name: /^Jarrett Allen/ })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getByRole('button', { name: /Check the Deal/ })).toBeEnabled()
  })
})
