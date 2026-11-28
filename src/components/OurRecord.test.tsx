import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchBookRecord } from '../api/client'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, BookRecord, CompareGame, CompareMarket, ComparePlayer, CompareTally } from '../lib/iddaaCompare'
import { OurRecord } from './OurRecord'

vi.mock('../api/client', async (orig) => ({ ...(await orig<object>()), fetchBookRecord: vi.fn() }))
const fetchMock = vi.mocked(fetchBookRecord)

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
})

const NOW = new Date('2026-11-22T12:00:00Z')

const win = (team: string, pick: number, hit: boolean | null): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours: 0.7,
  book: 0.6,
  actual: null,
  gap: 0.1,
  ours_hit: hit,
  book_hit: null,
  closer: null,
  odds: [
    { side: 'pick', odd: pick },
    { side: 'other', odd: 2.4 },
  ],
})

function scorer(name: string, team: string, rungs: [number, number, number][], actual: number | null): ComparePlayer {
  return {
    name,
    player_id: null,
    team,
    stat: 'pts',
    played: actual == null ? null : true,
    ladder: [],
    rungs: rungs.map(([n, odd, ours]) => ({ n, odd, book: 0.5, ours, value: null, hit: actual == null ? null : actual >= n })),
    ours: 24,
    book: 22.5,
    actual,
    gap: 1.5,
    ours_hit: null,
    book_hit: null,
    closer: null,
  }
}

const PTS = { stat: 'pts', rungs: 5, ours_rung_score: 0.15, book_rung_score: 0.19 } as CompareTally

/** Three games; `final` of them are over. */
function night(final: number, tally: CompareTally[] = []): BookCompare {
  const g = (i: number, m: CompareMarket, p: ComparePlayer[]): CompareGame => ({
    game_id: i,
    away: `A${i}`,
    home: `H${i}`,
    tip: '2026-11-23T00:00:00Z',
    checked: '',
    status: i <= final ? 'final' : 'scheduled',
    away_score: null,
    home_score: null,
    markets: [m],
    players: p,
  })
  const done = (i: number) => i <= final
  return {
    season: 2027,
    day: 34,
    date: '2026-11-22',
    days: [31, 32, 33, 34],
    nights: NIGHTS,
    bands: { pts: 5 },
    look: { checked: null, ok: null, error: null, games: 3, matched: 3 },
    games: [
      g(1, win('H1', 1.55, done(1) ? true : null), [scorer('Joel Embiid', 'H1', [[20, 1.4, 0.8], [25, 1.9, 0.55], [30, 2.9, 0.3]], done(1) ? 26 : null)]),
      g(2, win('H2', 1.6, done(2) ? false : null), [scorer('Nikola Jokic', 'H2', [[22, 1.42, 0.81], [28, 2.1, 0.5]], done(2) ? 18 : null)]),
      g(3, win('A3', 1.7, done(3) ? true : null), []),
    ],
    tally,
  }
}

const NIGHTS = [
  { day: 31, date: '2026-11-19', games: 6 },
  { day: 32, date: '2026-11-20', games: 4 },
  { day: 33, date: '2026-11-21', games: 5 },
  { day: 34, date: '2026-11-22', games: 3 },
]
const rn = (day: number, picks: number, hits: number, net: number, top: number | null) => ({
  day,
  settled: true,
  picks,
  hits,
  net,
  marked: 2,
  players: 4,
  top_hit: top,
})
const REC: BookRecord = {
  season: 2027,
  nights: 4,
  rungs: 3200,
  ours_score: 0.161,
  book_score: 0.17,
  picks: [
    { stat: 'all', odds_from: 1.33, odds_to: 1.6, picks: 10, hits: 8, said: 0.76, net: 1.5 },
    { stat: 'all', odds_from: 12, odds_to: null, picks: 4, hits: 1, said: 0.1, net: 10.2 },
  ],
  calibration: [
    { side: 'ours', chance_from: 0.4, chance_to: 0.5, rungs: 300, said: 0.45, happened: 0.43 },
    { side: 'book', chance_from: 0.4, chance_to: 0.5, rungs: 300, said: 0.45, happened: 0.37 },
  ],
  series: [rn(30, 8, 3, 9.2, 14.2), rn(32, 0, 0, 0, null), rn(33, 6, 6, 2.5, 1.9)],
}
const EMPTY: BookRecord = { ...REC, nights: 1, picks: [], calibration: [], series: [] }

function show(data: BookCompare | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OurRecord data={data} lines={data ? linesOf(data, NOW) : undefined} />
    </QueryClientProvider>,
  )
}

const counts = (c: HTMLElement) => [...c.querySelectorAll('.ic-rec-count')].map((li) => li.textContent)

describe('Our record: three counts', () => {
  it('before results: bets, Kupons and rungs open, on the bare page with no ribbon or scorecard', async () => {
    fetchMock.mockResolvedValue(EMPTY)
    const { container } = show(night(0))
    expect(screen.getByRole('heading', { level: 2, name: 'Our record' })).toBeTruthy()
    const [bets, , rungs] = counts(container)
    expect(bets).toBe('5bets open3 game · 2 player')
    expect(counts(container)[1]).toMatch(/Kupons? (open|tonight)/)
    expect(rungs).toBe('5rungs waitingOurs vs the book, every rung')
    await waitFor(() => expect(container.querySelector('.ic-rec-sm')?.textContent).toBe('Night 1 · fills in as games go final'))
    expect(screen.queryByRole('button', { name: /Running record/ })).toBeNull() // nothing settled yet
    expect(container.querySelector('.vr-ribbon, .vr-sc-card, .vr-rec-tile, .vr-circ')).toBeNull()
    expect(screen.queryByText(/Who won, stat by stat/)).toBeNull()
  })

  it('as games go final: the same three slots fill in, and the running record opens behind one row', async () => {
    fetchMock.mockResolvedValue(EMPTY)
    const { container } = show(night(2, [PTS]))
    const [bets, , rungs] = counts(container)
    // settled: H1 won +0.55, H2 lost, Embiid 20+ won +0.40, Jokic 22+ lost; A3 to win still open
    expect(bets).toBe('2of 4bets won−1.05 at 1 a bet · 1 open')
    expect(container.querySelector('.ic-rec-s b')?.className).toContain('bad')
    // Embiid 26: ours on 20+, 25+, 30+; Jokic 18: book on 22+, level on 28+
    expect(rungs).toBe('3of 5rungs ours read closerBook 1 · level 1')
    await waitFor(() => expect(container.querySelector('.ic-rec-sm')?.textContent).toBe('Night 1 · 2 of 3 games final'))
    const row = screen.getByRole('button', { name: /Running record/ })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('heading', { name: /Sun 22 Nov by stat/ })).toBeTruthy()
  })

  it('all final: Kupons won or not, and "all games final"', async () => {
    fetchMock.mockResolvedValue(EMPTY)
    const { container } = show(night(3, [PTS]))
    expect(counts(container)[0]).toMatch(/^3of 5bets won/)
    expect(counts(container)[1]).toMatch(/Kupons? won/)
    await waitFor(() => expect(container.querySelector('.ic-rec-sm')?.textContent).toBe('Night 1 · all games final'))
  })

  it('a night iddaa has not posted yet shows no counts', () => {
    fetchMock.mockResolvedValue(EMPTY)
    const data = { ...night(0), games: night(0).games.map((g) => ({ ...g, markets: [], players: [] })) }
    expect(show(data).container.innerHTML).toBe('')
  })
})

describe('Our record: the running record row', () => {
  it('pending: nothing until the record is read', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    expect(show(null).container.innerHTML).toBe('')
  })
  it('failed: one quiet line with a way to try again, the counts unaffected', async () => {
    fetchMock.mockRejectedValue(new ApiError(500, 'http_error', 'down'))
    const { container } = show(night(0))
    expect((await screen.findByRole('alert')).textContent).toContain("Couldn't load the running record.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(counts(container)).toHaveLength(3)
  })
  it('a server without the endpoint: no row and no error', async () => {
    fetchMock.mockRejectedValue(new ApiError(404, 'http_error', 'Not Found'))
    const { container } = show(null)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
  it('with a series: the row sums it up and opens the balance, the ledger and the early read', async () => {
    fetchMock.mockResolvedValue(REC)
    const { container } = show(night(0))
    const row = await screen.findByRole('button', { name: /Running record/ })
    expect(row.textContent).toContain('9 of 14 value picks landed')
    expect(container.querySelector('.ic-rec-sm')?.textContent).toBe('Night 4 · fills in as games go final')
    fireEvent.click(row)
    expect(screen.getByText('Without the biggest hit')).toBeTruthy()
    expect(screen.getByText('−1.50')).toBeTruthy() // 11.70 − (14.20 − 1)
    expect(screen.getByText("Ladders didn't load")).toBeTruthy()
    expect(container.querySelector('.vr-rec-chart')).not.toBeNull() // jsdom has no width, so the svg itself waits
    expect(container.querySelector('.vr-early')?.textContent).toBe('Early read · 3 of 14 nights')
    expect(container.querySelector('.vr-early i')).toBeNull() // no pips
    expect(screen.getByText(/too few to tell a good read from luck/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('without a night: only the row, no counts', async () => {
    fetchMock.mockResolvedValue({ ...REC, series: [] })
    const { container } = show(null)
    fireEvent.click(await screen.findByRole('button', { name: /Running record/ }))
    expect(screen.getByText('Without the 12+ shelf')).toBeTruthy()
    expect(screen.queryByText('Ledger')).toBeNull()
    expect(counts(container)).toHaveLength(0)
  })
  it('the small-sample line goes once there are two weeks of nights', async () => {
    const many = Array.from({ length: 14 }, (_, i) => rn(20 + i, 5, 2, 0.5, 2.4))
    fetchMock.mockResolvedValue({ ...REC, nights: 14, series: many })
    show(null)
    fireEvent.click(await screen.findByRole('button', { name: /Running record/ }))
    await screen.findByText('Without the biggest hit')
    expect(screen.queryByText(/Early read/)).toBeNull()
    expect(screen.queryByText(/too few to tell/)).toBeNull()
  })
})
