import type { UseQueryResult } from '@tanstack/react-query'
import { render, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OfferCheck, PlayerRef } from '../api/client'
import { EMPTY_DEAL, type CheckDeal } from '../lib/tradeCheck'
import sample from '../test/offer-check-1for2.json'
import { TradeCheckResult } from './TradeCheckResult'

const check = sample as unknown as OfferCheck

function show(c: OfferCheck, mode: CheckDeal['mode']) {
  const query = {
    data: c,
    isPlaceholderData: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<OfferCheck>
  const deal = { ...EMPTY_DEAL, partner: 9, give: [1], get: [2, 3], mode }
  const { container } = render(
    <TradeCheckResult
      query={query}
      deal={deal}
      give={c.idea.give as PlayerRef[]}
      get={c.idea.get as PlayerRef[]}
      myName="K"
      partnerName="Horns"
      espn={{ leagueId: 1, season: 2027, myTeamId: 3 }}
      roster={[]}
      keep={[]}
      onCut={vi.fn()}
    />,
  )
  return within(container)
}

describe('TradeCheckResult', () => {
  it('offers Accept on ESPN for a good offer they sent, with no pitch', () => {
    const view = show(check, 'received')
    expect(view.getByRole('link', { name: /Accept on ESPN/ })).toHaveAttribute(
      'href',
      'https://fantasy.espn.com/basketball/team?leagueId=1&teamId=3&seasonId=2027',
    )
    expect(view.queryByText(/your pitch to/i)).toBeNull()
    expect(view.queryByText('Chance they say yes')).toBeNull()
  })

  it('puts the counter slot and the pitch first when you send a pass', () => {
    const view = show({ ...check, call: 'pass' }, 'sending')
    expect(view.getByRole('heading', { name: 'Counter Offer' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Find a Counter' })).toBeDisabled()
    expect(view.getByRole('heading', { name: 'If you send it anyway: your pitch to Horns' })).toBeInTheDocument()
    expect(view.getByRole('link', { name: /Propose on ESPN/ })).toHaveAttribute(
      'href',
      'https://fantasy.espn.com/basketball/team?leagueId=1&teamId=9&seasonId=2027',
    )
    expect(view.queryByRole('link', { name: /Accept on ESPN/ })).toBeNull()
  })
})
