import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, ComparePlayer } from '../lib/iddaaCompare'
import { setPlayerCardHost } from '../lib/playerCard'
import { EstimateTools, TOOLS_KEY } from './EstimateTools'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
  vi.restoreAllMocks()
  localStorage.clear()
})

const pl = (name: string, id: number, ours: number, book: number): ComparePlayer => ({
  name,
  player_id: id,
  team: 'NY',
  stat: 'ast',
  played: null,
  ladder: [],
  rungs: [
    { n: 7, odd: 1.47, book: 0.6, ours: 0.666, value: -0.02, hit: null },
    { n: 9, odd: 3.1, book: 0.25, ours: 0.2, value: -0.38, hit: null },
  ],
  ours,
  book,
  actual: null,
  gap: ours - book,
  ours_hit: null,
  book_hit: null,
  closer: null,
})

const DATA: BookCompare = {
  season: 2027,
  day: 34,
  date: '2026-11-22',
  days: [34],
  nights: [{ day: 34, date: '2026-11-22', games: 1 }],
  bands: { ast: 2 },
  look: { checked: '2026-11-22T21:33:00Z', ok: true, error: null, games: 1, matched: 1 },
  games: [
    {
      game_id: 1,
      away: 'IND',
      home: 'NY',
      tip: '2099-11-22T22:00:00Z',
      checked: '2026-11-22T21:33:00Z',
      status: 'scheduled',
      away_score: null,
      home_score: null,
      markets: [],
      players: [pl('Andrew Nembhard', 41, 7.4, 6.5), pl('Josh Hart', 42, 5.0, 5.5)],
    },
  ],
  tally: [],
}

function mount() {
  const lines = linesOf(DATA, new Date('2026-11-22T20:00:00Z'))
  return render(
    <EstimateTools
      data={DATA}
      lines={lines}
      settled={false}
      divided={<p>the field</p>}
      boxes={<p>the game boxes</p>}
    />,
  )
}

const row = (name: string) => screen.getByRole('button', { name })

describe('Tools', () => {
  it('shows three disclosure rows, Value rungs open at first', () => {
    mount()
    expect(screen.getByRole('heading', { level: 2, name: 'Tools' })).toBeTruthy()
    expect(row('Value rungs').getAttribute('aria-expanded')).toBe('true')
    expect(row('How divided').getAttribute('aria-expanded')).toBe('false')
    expect(row('Every line').getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.vr-tape')).not.toBeNull()
    expect(screen.queryByText('the field')).toBeNull()
    // no browser disclosure triangles: buttons, not <details>
    expect(document.querySelector('.ic-tl details, .ic-tl summary')).toBeNull()
  })

  it('says what each row holds while closed', () => {
    mount()
    const line = (name: string) => row(name).closest('li')!.querySelector('.ic-tl-line')!.textContent
    expect(line('Value rungs')).toBe(
      '0 of 4 rungs beat their price · closest Andrew Nembhard 7+ assists at 1.47, −0.02',
    )
    expect(line('How divided')).toBe('Every player line at its gap · ours above on 1')
    expect(line('Every line')).toMatch(/^2 player lines · \d+ game lines with team points$/)
  })

  it('opens and closes rows and remembers them in this browser', () => {
    const { unmount } = mount()
    fireEvent.click(row('Every line'))
    expect(screen.getByText('the game boxes')).toBeTruthy()
    fireEvent.click(row('Value rungs'))
    expect(document.querySelector('.vr-tape')).toBeNull()
    expect(JSON.parse(localStorage.getItem(TOOLS_KEY)!)).toEqual(['lines'])
    unmount()
    mount()
    expect(row('Every line').getAttribute('aria-expanded')).toBe('true')
    expect(row('Value rungs').getAttribute('aria-expanded')).toBe('false')
  })

  it('works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    mount()
    expect(row('Value rungs').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(row('How divided'))
    expect(screen.getByText('the field')).toBeTruthy()
  })

  it("the header line's player opens his card, with his face, and sits outside the row's button", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    mount()
    const li = row('Value rungs').closest('li')!
    const name = within(li).getByRole('button', { name: 'Andrew Nembhard' })
    expect(name.closest('.ic-tl-btn')).toBeNull()
    expect(row('Value rungs').querySelector('button')).toBeNull()
    expect(li.querySelector('.ic-tl-line .pc-link-face .head')).not.toBeNull()
    fireEvent.click(name)
    expect(open).toHaveBeenCalledWith({ id: 41, name: 'Andrew Nembhard' })
    expect(row('Value rungs').getAttribute('aria-expanded')).toBe('true') // the row stays as it was
  })
})
