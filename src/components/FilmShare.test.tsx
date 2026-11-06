import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from '../api/client'
import type { WeekRecap } from '../api/client'
import { readRecap } from '../lib/filmRoom'
import { teamColours } from '../lib/league'
import week2 from '../test/recap-week2.json'
import { FilmPostCard, FilmShare } from './FilmShare'

vi.mock('../api/client', async (orig) => ({
  ...(await orig<typeof import('../api/client')>()),
  createPost: vi.fn(async () => ({})),
  fetchRecap: vi.fn(async () => week2),
}))

afterEach(cleanup)

const recap = week2 as unknown as WeekRecap
const ref = { leagueId: 744636428, season: 2027 }
const name = (id: number) => recap.teams.find((t) => t.team_id === id)?.name ?? '?'
const colours = teamColours(
  recap.teams.map((t) => t.team_id),
  3,
)
const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>

describe('posting game balls to League Chat', () => {
  it('previews the card and posts the readable text with your line', async () => {
    render(wrap(<FilmShare recap={recap} d={readRecap(recap, 3)} name={name} colours={colours} leagueRef={ref} />))
    fireEvent.click(screen.getByRole('button', { name: 'Post game balls to League Chat' }))
    expect(screen.getByLabelText('Preview').textContent).toContain('Victor Wembanyama')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Diabate was right there.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post' }))
    await waitFor(() => expect(client.createPost).toHaveBeenCalled())
    const [, body, target] = vi.mocked(client.createPost).mock.calls[0]
    expect(body.startsWith('🎬 Week 2 Film Room. Game balls: Victor Wembanyama (13 BLK, 3 G')).toBe(true)
    expect(body.endsWith('\nDiabate was right there.')).toBe(true)
    expect(target).toBeNull()
    expect(await screen.findByText('Posted to League Chat')).toBeInTheDocument()
  })
})

describe('a shared Film Room post in chat', () => {
  it('shows the week as a game-ball card that opens the Film Room', async () => {
    const onOpen = vi.fn()
    render(wrap(<FilmPostCard leagueRef={ref} creds={null} period={2} name={name} colours={colours} onOpen={onOpen} />))
    expect(await screen.findByText('Kavaklidere Boytoys')).toBeInTheDocument()
    expect(screen.getByText('Victor Wembanyama')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Open the Film Room/ }))
    expect(onOpen).toHaveBeenCalledWith(2)
  })
})
