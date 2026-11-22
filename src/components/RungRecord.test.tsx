import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchBookRecord } from '../api/client'
import type { BookRecord } from '../lib/iddaaCompare'
import { RecordRibbon, RungRecord } from './RungRecord'

vi.mock('../api/client', async (orig) => ({ ...(await orig<object>()), fetchBookRecord: vi.fn() }))
const fetchMock = vi.mocked(fetchBookRecord)

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
})

const NIGHTS = [
  { day: 31, date: '2026-11-19', games: 6 },
  { day: 32, date: '2026-11-20', games: 4 },
  { day: 33, date: '2026-11-21', games: 5 },
]
const night = (day: number, picks: number, hits: number, net: number, top: number | null) => ({
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
  series: [night(30, 8, 3, 9.2, 14.2), night(32, 0, 0, 0, null), night(33, 6, 6, 2.5, 1.9)],
}

function show(nights = NIGHTS, day: number | null = 33) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RecordRibbon nights={nights} />
      <RungRecord nights={nights} day={day} />
    </QueryClientProvider>,
  )
}

describe('Running Record states', () => {
  it('pending: a quiet line and no ribbon', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    show()
    expect(screen.getByRole('status').textContent).toBe('Reading the record…')
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('failed: says so with a way to try again, and no ribbon', async () => {
    fetchMock.mockRejectedValue(new ApiError(500, 'http_error', 'down'))
    show()
    expect(await screen.findByText("Couldn't load the running record.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('a server without the endpoint: nothing at all', async () => {
    fetchMock.mockRejectedValue(new ApiError(404, 'http_error', 'Not Found'))
    const { container } = show()
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
  it('empty: no settled value rungs yet', async () => {
    fetchMock.mockResolvedValue({ ...REC, nights: 0, picks: [], calibration: [], series: [] })
    show()
    expect(await screen.findByText('No settled value rungs yet.')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('with a series: the balance, the ribbon, the ledger with the skipped night, and the early read', async () => {
    fetchMock.mockResolvedValue(REC)
    const { container } = show()
    expect(await screen.findByText('Without the biggest hit')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('#vr-record')
    expect(screen.getByRole('link').textContent).toContain('9 of 14 landed')
    expect(screen.getByText('−1.50')).toBeTruthy() // 11.70 − (14.20 − 1)
    expect(screen.getByText("ladders didn't load")).toBeTruthy()
    expect(screen.getByText('the night above')).toBeTruthy()
    expect(container.querySelector('.vr-rec-chart')).not.toBeNull() // jsdom has no width, so the svg itself waits
    expect(screen.getByText(/Early read · 3 of 14 nights/)).toBeTruthy()
    expect(screen.getByText(/too few to tell a good read from luck/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1) // one query for the ribbon and the section
  })
  it('without a series: no chart or ledger, the 12+ shelf tile instead', async () => {
    fetchMock.mockResolvedValue({ ...REC, series: [] })
    const { container } = show()
    expect(await screen.findByText('Without the 12+ shelf')).toBeTruthy()
    expect(screen.queryByText('Ledger')).toBeNull()
    expect(container.querySelector('.vr-rec-chart')).toBeNull()
  })
  it('the small-sample line goes once there are two weeks of nights', async () => {
    const many = Array.from({ length: 14 }, (_, i) => night(20 + i, 5, 2, 0.5, 2.4))
    fetchMock.mockResolvedValue({ ...REC, nights: 14, series: many })
    show([{ day: 20, date: '2026-11-08', games: 5 }])
    await screen.findByText('Without the biggest hit')
    expect(screen.queryByText(/Early read/)).toBeNull()
    expect(screen.queryByText(/too few to tell/)).toBeNull()
  })
})
