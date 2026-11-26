import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCrazyOne } from '../api/client'
import type { CrazyGame, CrazyOne as CrazyData } from '../api/client'
import { CrazyDoor } from './CrazyDoor'
import { CrazyOne } from './CrazyOne'

vi.mock('../api/client', async (orig) => ({ ...(await orig<object>()), fetchCrazyOne: vi.fn() }))
const fetchMock = vi.mocked(fetchCrazyOne)

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
})

const okc: CrazyGame = {
  game_id: 1,
  day: 37,
  away: 'MIN',
  home: 'OKC',
  tip: '2026-11-26T01:30:00Z',
  final: null,
  ours: { away: 111, home: 109.3, home_chance: 0.444 },
  crazy: { away: 109.5, home: 110.4, home_chance: 0.53 },
  book_home_chance: 0.558,
  swing: 0.086,
  beliefs: [{ belief: 'rivalry', team: 'OKC', points: 2.4 }],
}
const quiet: CrazyGame = {
  ...okc,
  game_id: 2,
  away: 'BOS',
  home: 'NYK',
  ours: { away: 108, home: 112, home_chance: 0.62 },
  crazy: { away: 108, home: 112, home_chance: 0.62 },
  swing: 0,
  beliefs: [],
  final: [101, 115],
  crazy_hit: true,
  ours_hit: true,
}

function data(over: Partial<CrazyData> = {}): CrazyData {
  return {
    season: 2027,
    day: 37,
    days: [36, 37],
    games: [quiet, okc],
    record: {
      games: 1,
      crazy_hits: 1,
      ours_hits: 1,
      edge: null,
      edge_low: null,
      edge_high: null,
      leading: false,
      bold: [],
    },
    ...over,
  }
}

function show(onBack = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <CrazyOne onBack={onBack} />
    </QueryClientProvider>,
  )
  return onBack
}

describe('CrazyDoor', () => {
  it('is a labelled button that opens the world', () => {
    const open = vi.fn()
    render(<CrazyDoor onOpen={open} />)
    fireEvent.click(screen.getByRole('button', { name: "Go to Crazy One's World" }))
    expect(open).toHaveBeenCalled()
  })
})

describe('CrazyOne', () => {
  it('leads with its craziest call in its own voice, never as Our call', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    expect(await screen.findByText('I think OKC wins tonight. You don’t.')).toBeTruthy()
    expect(screen.getByText('Persona · not Our call')).toBeTruthy()
    const loud = screen.getByRole('article', { name: 'Tonight’s craziest call' })
    expect(loud.textContent).toContain('Our call, OKC win chance')
    expect(loud.textContent).toContain('Crazy One’s call, OKC win chance53%')
  })

  it('ranks the games it moved first and agrees on the rest, with hits in words', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    await screen.findByText('I agree with you.')
    const rows = screen.getAllByRole('listitem').filter((li) => li.classList.contains('cz-game'))
    expect(rows[0].textContent).toContain('MIN')
    expect(rows[0].textContent).toContain('Other winner')
    expect(rows[1].textContent).toContain('Crazy One hit')
    expect(rows[1].textContent).toContain('Our call hit')
  })

  it('shows a total belief as the total, agreeing on the winner', async () => {
    const shows: CrazyGame = {
      ...quiet,
      game_id: 3,
      final: null,
      crazy_hit: null,
      ours_hit: null,
      crazy: { away: 107.5, home: 111.5, home_chance: 0.62 },
      beliefs: [{ belief: 'one_man', team: '', points: -1 }],
    }
    fetchMock.mockResolvedValue(data({ games: [okc, shows] }))
    show()
    expect(await screen.findByText('I agree on the winner.')).toBeTruthy()
    expect(screen.getByText(/Two one-man shows total/)).toBeTruthy()
    expect(screen.getByText(/Total/).textContent).toContain('220.0 → 219.0')
  })

  it('says it is too early instead of a lead', async () => {
    fetchMock.mockResolvedValue(
      data({ record: { ...data().record, games: 3, edge: 0.01, edge_low: -0.05, edge_high: 0.07 } }),
    )
    show()
    expect(await screen.findByText(/Too early: the range still crosses zero/)).toBeTruthy()
  })

  it('shows an empty night and the way back', async () => {
    fetchMock.mockResolvedValue(data({ games: [], days: [], day: null, record: { ...data().record, games: 0 } }))
    const back = show()
    expect(await screen.findByText(/No calls for this night yet/)).toBeTruthy()
    expect(screen.getByText(/No record yet\. Its first calls/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Our Estimates' }))
    expect(back).toHaveBeenCalled()
  })

  it('moves between nights', async () => {
    fetchMock.mockResolvedValue(data())
    show()
    const before = await screen.findByRole('button', { name: 'Night before' })
    expect(screen.getByRole('button', { name: 'Night after' })).toHaveProperty('disabled', true)
    fireEvent.click(before)
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(36))
  })
})
