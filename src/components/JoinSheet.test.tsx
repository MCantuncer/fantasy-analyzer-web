import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { P, pickup, report } from '../test/newsSince'
import { JoinSheet } from './JoinSheet'

function renderSheet(mode: 'signup' | 'signin' = 'signup') {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ google_client_id: null })))
  const onClose = vi.fn()
  const onSignedIn = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={client}>
      <JoinSheet
        mode={mode}
        scoutName="Horns"
        scoutReport={report({ pickups: [pickup(P.lopez, 0.47, 0.51)] })}
        theme="dark"
        onSignedIn={onSignedIn}
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
  return { ...view, onClose, onSignedIn }
}

describe('JoinSheet', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mirrors the scouted team against yours, then asks for the league first', () => {
    const { container } = renderSheet()
    const view = within(container)
    expect(view.getByRole('dialog', { name: 'Get your own best move' })).toBeInTheDocument()
    const rows = container.querySelectorAll('.join-mirror-row')
    expect(rows[0].textContent).toContain('Horns')
    expect(rows[0].textContent).toContain('47%')
    expect(rows[0].textContent).toContain('51%')
    expect(rows[1].textContent).toContain('Your team')
    expect(container.querySelector('.join-steps .now')?.textContent).toContain('League')
    expect(view.getByLabelText('Your ESPN league')).toHaveFocus()
  })

  it('says when the paste is not a league, and moves on to the account when it is', () => {
    const { container } = renderSheet()
    const view = within(container)
    fireEvent.click(view.getByRole('button', { name: 'Next' }))
    expect(view.getByRole('alert').textContent).toContain("doesn't look like an ESPN league")
    fireEvent.change(view.getByLabelText('Your ESPN league'), {
      target: { value: 'https://fantasy.espn.com/basketball/team?leagueId=123456&teamId=4&seasonId=2027' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Next' }))
    expect(container.querySelector('.join-steps .now')?.textContent).toContain('Account')
    expect(view.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('opens on sign-in for an account, and closes with Keep scouting or Escape', () => {
    const { container, onClose } = renderSheet('signin')
    const view = within(container)
    expect(view.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(container.querySelector('.join-steps')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Keep scouting' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
