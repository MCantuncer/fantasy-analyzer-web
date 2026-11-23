import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, ComparePlayer } from '../lib/iddaaCompare'
import { setPlayerCardHost } from '../lib/playerCard'
import { ValueRungs, ValueRungsLine } from './ValueRungs'

afterEach(() => {
  cleanup()
  setPlayerCardHost(null)
})

function player(name: string, rungs: ComparePlayer['rungs'], actual: number | null): ComparePlayer {
  return {
    name,
    player_id: null,
    team: 'POR',
    stat: 'blk',
    played: actual == null ? null : true,
    ladder: [],
    ours: 2.2,
    book: 1.5,
    actual,
    gap: 0.7,
    ours_hit: null,
    book_hit: null,
    closer: null,
    rungs,
    rung_closer: null,
  }
}

function night(players: ComparePlayer[], status: CompareGame['status']): BookCompare {
  return {
    season: 2027,
    day: 33,
    date: '2026-11-21',
    days: [33],
    nights: [{ day: 33, date: '2026-11-21', games: 1 }],
    bands: {},
    look: { checked: null, ok: null, error: null, games: 1, matched: 1 },
    games: [
      {
        game_id: 1,
        away: 'POR',
        home: 'NY',
        tip: '2026-11-22T00:30:00Z',
        checked: '2026-11-22T00:20:00Z',
        status,
        away_score: null,
        home_score: null,
        markets: [],
        players,
      },
    ],
    tally: [],
  }
}

function show(data: BookCompare, now: string) {
  const settled = data.games.every((g) => g.status === 'final')
  return render(<ValueRungs data={data} lines={linesOf(data, new Date(now))} settled={settled} />)
}

const CLINGAN = (hit: boolean | null) => [
  { n: 4, odd: 6.27, book: 0.13, ours: 0.19, value: 0.19, hit },
  { n: 5, odd: 15.1, book: 0.054, ours: 0.096, value: 0.45, hit: hit == null ? null : false },
]

describe('Value Rungs states', () => {
  it('settled: the picks with landed and missed, and both data-written notes', () => {
    show(night([player('Donovan Clingan', CLINGAN(true), 4)], 'final'), '2026-11-22T20:00:00Z')
    expect(screen.getByRole('heading', { name: 'How the 2 went' })).toBeTruthy()
    expect(screen.getAllByText('Landed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Missed').length).toBeGreaterThan(0)
    expect(screen.getByText('What +0.45 means')).toBeTruthy()
    expect(screen.queryByText('One player, one call')).toBeNull() // 2 rungs: under the rule's 3
    expect(screen.getAllByLabelText(/Donovan Clingan, 5\+ blocks at 15.10: ours 9.6%, needs 6.6%/)).toHaveLength(1)
  })
  it('tonight: pending rows show the tip and the time of the odds', () => {
    show(night([player('Donovan Clingan', CLINGAN(null), null)], 'scheduled'), '2026-11-21T20:00:00Z')
    expect(screen.getByRole('heading', { name: "Tonight's 2" })).toBeTruthy()
    expect(screen.getAllByText(/odds of/).length).toBe(2)
    expect(screen.getByText(/Our chances say/).textContent).toBe('Our chances say 0.3 of 2 land · +0.64 on average if they are right')
  })
  it('empty: no rung beat its price, the dot tape still shows each band and its average', () => {
    const none = [
      { n: 2, odd: 2.4, book: 0.34, ours: 0.3, value: -0.28, hit: false },
      { n: 3, odd: 6.5, book: 0.12, ours: 0.1, value: -0.35, hit: false },
    ]
    const { container } = show(night([player('Donovan Clingan', none, 1)], 'final'), '2026-11-22T20:00:00Z')
    expect(screen.queryByRole('heading', { name: /went|Tonight's/ })).toBeNull()
    const bands = [...container.querySelectorAll('.vr-tape li')]
    expect(bands.map((b) => b.querySelector('.vr-tb b')?.textContent)).toEqual(['1.61–2.50', '5.01–12.00'])
    expect(bands[0].querySelector('.vr-ta')?.textContent).toBe('Average −0.28')
    expect(bands[0].querySelectorAll('.vr-strip i:not(.avg)')).toHaveLength(1)
    expect(container.querySelectorAll('.vr-strip i.avg')).toHaveLength(2)
    expect(screen.getByText(/Each dot is one rung/)).toBeTruthy()
  })
  it('no stamp boxes or pips on a value row: the value is a plain number', () => {
    const { container } = show(night([player('Donovan Clingan', CLINGAN(null), null)], 'scheduled'), '2026-11-21T20:00:00Z')
    expect(container.querySelector('.vr-stamp, .vr-pip, .vr-pip-strip, .vr-tiles')).toBeNull()
    expect(container.querySelector('.vr-row .vr-val b')?.textContent).toMatch(/^\+0\.\d\d$/)
  })
  it("failed: the ladders didn't load and the night is left out of the record", () => {
    show(night([player('Donovan Clingan', [], 4)], 'final'), '2026-11-22T20:00:00Z')
    expect(screen.getByText(/ladders didn't load for Sat 21 Nov/)).toBeTruthy()
    expect(screen.getByText(/this night is not in the record/)).toBeTruthy()
  })
  it('a server from before the rungs: nothing at all', () => {
    const { container } = show(night([player('Donovan Clingan', undefined, 4)], 'final'), '2026-11-22T20:00:00Z')
    expect(container.innerHTML).toBe('')
  })
})

describe('Value Rungs players', () => {
  it("every player name opens the player's card, and each row carries the player's face", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const p = { ...player('Donovan Clingan', CLINGAN(null), null), player_id: 4433 }
    const { container } = show(night([p], 'scheduled'), '2026-11-21T20:00:00Z')
    const names = screen.getAllByRole('button', { name: 'Donovan Clingan' })
    expect(names.length).toBeGreaterThan(0)
    fireEvent.click(names[0])
    expect(open).toHaveBeenCalledWith({ id: 4433, name: 'Donovan Clingan' })
    for (const row of container.querySelectorAll('.vr-row-who'))
      expect(row.querySelector('.pc-link-face')).not.toBeNull()
  })
})

describe('Value rungs header line', () => {
  it("names the closest rung's player with his face, both opening his card", () => {
    const open = vi.fn()
    act(() => setPlayerCardHost({ open, prefetch: () => {} }))
    const none = [
      { n: 7, odd: 1.47, book: 0.6, ours: 0.666, value: -0.02, hit: null },
      { n: 8, odd: 2.2, book: 0.4, ours: 0.3, value: -0.34, hit: null },
    ]
    const data = night([{ ...player('Andrew Nembhard', none, null), player_id: 4395712, stat: 'ast' }], 'scheduled')
    const { container } = render(
      <p>
        <ValueRungsLine data={data} lines={linesOf(data, new Date('2026-11-21T20:00:00Z'))} />
      </p>,
    )
    expect(container.textContent).toBe('0 of 2 rungs beat their price · closest Andrew Nembhard 7+ assists at 1.47, −0.02')
    fireEvent.click(screen.getByRole('button', { name: 'Andrew Nembhard' }))
    expect(open).toHaveBeenCalledWith({ id: 4395712, name: 'Andrew Nembhard' })
    expect(container.querySelector('.vr-l-who .pc-link-face .head')).not.toBeNull()
  })
})
