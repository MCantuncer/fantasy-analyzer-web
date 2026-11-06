import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startTeamLink } from '../api/client'
import type { OverviewTeam, TeamLinkChallenge } from '../api/client'
import { VerifyTeam } from './VerifyTeam'

afterEach(cleanup)

const codes = ['QDHT', 'MPRC']

vi.mock('../api/client', async (orig) => ({
  ...(await orig<typeof import('../api/client')>()),
  startTeamLink: vi.fn(
    async (): Promise<TeamLinkChallenge> => ({
      challenge: 'signed',
      code: codes.shift()!,
      expires_at: '2026-11-06T15:00:00Z',
      team_id: 2,
      team_name: 'Yasamkent Dawgs',
      current_abbrev: 'DAWG',
    }),
  ),
}))

const team = { id: 2, name: 'Yasamkent Dawgs', abbrev: 'DAWG', mine: false, has_manager: false } as OverviewTeam

describe('VerifyTeam', () => {
  it('hands out a different code when ESPN refuses the first one', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <VerifyTeam
          leagueRef={{ leagueId: 1, season: 2027 }}
          leagueName="OCB"
          teams={[team]}
          creds={null}
          onVerified={() => undefined}
          onCancel={() => undefined}
        />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('radio', { name: /Yasamkent Dawgs/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Get my code' }))
    expect(await screen.findByLabelText('Code Q D H T')).toBeInTheDocument()
    expect(screen.getByText(/ESPN says it has a banned word\?/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Get a different code' }))
    expect(await screen.findByLabelText('Code M P R C')).toBeInTheDocument()
    expect(startTeamLink).toHaveBeenCalledTimes(2)
  })
})
