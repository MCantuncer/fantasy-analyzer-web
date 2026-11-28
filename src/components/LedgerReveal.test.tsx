import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecordLeg } from '../lib/iddaaCompare'
import type { LedgerNight } from '../lib/rungRecord'
import { Ledger } from './LedgerReveal'

const leg = (name: string, id: number, stat: string, n: number, odd: number, actual: number): RecordLeg => ({
  name,
  player_id: id,
  team: 7,
  stat,
  n,
  odd,
  ours: 0.5,
  hit: actual >= n,
  actual,
})
const night = (day: number, label: string, legs: RecordLeg[], balance: number, kind: LedgerNight['kind'] = 'night'): LedgerNight => ({
  day,
  label,
  date: null,
  kind,
  picks: legs.length,
  hits: legs.filter((l) => l.hit).length,
  net: Math.round(legs.reduce((s, l) => s + (l.hit ? l.odd - 1 : -1), 0) * 100) / 100,
  marked: 0,
  players: new Set(legs.map((l) => l.player_id)).size,
  top: null,
  balance,
  legs,
})
// oldest first, as ledgerOf gives it
const LEDGER = [
  night(30, 'Mon 23', [leg('Nikola Jokić', 1, 'pts', 25, 1.42, 31), leg('Nikola Jokić', 1, 'pts', 35, 3.4, 31), leg('Jayson Tatum', 2, 'reb', 10, 1.85, 11)], 0.27),
  night(31, 'Tue 24', [], 0.27, 'empty'),
  night(32, 'Wed 25', [], 0.27, 'none'),
]

function wide(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('min-width') ? on : !on,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Ledger (Waterline)', () => {
  it('a night with picks is a button that draws them; nights without are quiet rows', () => {
    const { container } = render(<Ledger ledger={LEDGER} day={null} />)
    const row = screen.getByRole('button', { name: 'Mon 23: 2 of 3 landed, net +0.27, balance +0.27' })
    expect(row.getAttribute('aria-expanded')).toBe('false')
    // skyline: Tatum's one ladder (+0.85) first, then Jokić's; landed blocks are solid
    const sky = row.querySelector('.vr-led-sky')!
    expect([...sky.querySelectorAll('.p')].map((p) => p.querySelectorAll('i').length)).toEqual([1, 2])
    expect(sky.querySelectorAll('i.y')).toHaveLength(2)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('No picks')).toBeTruthy()
    expect(screen.getByText("Ladders didn't load")).toBeTruthy()
    expect(container.querySelector('.vr-led-row.quiet .vr-led-net')?.textContent).toBe('–')
  })

  it('on a phone a tap opens the night in a sheet: players, each rung landed or missed, what he got', () => {
    wide(false)
    render(<Ledger ledger={LEDGER} day={null} />)
    const row = screen.getByRole('button', { name: /^Mon 23/ })
    fireEvent.click(row)
    const sheet = screen.getByRole('dialog', { name: 'Mon 23' })
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(within(sheet).getByText('Nikola Jokić')).toBeTruthy()
    expect(within(sheet).getByRole('img', { name: 'points 25+ at 1.42, landed' })).toBeTruthy()
    expect(within(sheet).getByRole('img', { name: 'points 35+ at 3.40, missed' })).toBeTruthy()
    expect(within(sheet).getByRole('img', { name: 'he got 31' })).toBeTruthy()
    // the waterline stands between what landed and what missed
    const lad = within(sheet).getByRole('img', { name: 'he got 31' }).parentElement!
    expect([...lad.children].map((c) => c.textContent)).toEqual(['PTS', '25+1.42', '31', '35+3.40'])
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(row.getAttribute('aria-expanded')).toBe('false')
  })

  it('on a wide screen a hover opens the panel beside the ledger after a beat, and leaving closes it', () => {
    vi.useFakeTimers()
    wide(true)
    render(<Ledger ledger={LEDGER} day={null} />)
    const row = screen.getByRole('button', { name: /^Mon 23/ })
    fireEvent.pointerEnter(row, { pointerType: 'mouse' })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    const dock = screen.getByRole('dialog', { name: 'Mon 23' })
    expect(dock.className).toContain('vr-led-dock')
    expect(within(dock).queryByRole('button', { name: 'Close' })).toBeNull() // only once pinned
    fireEvent.pointerLeave(row, { pointerType: 'mouse' })
    act(() => vi.advanceTimersByTime(250))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a click pins it until Close, Esc or a second click', () => {
    wide(true)
    render(<Ledger ledger={LEDGER} day={null} />)
    const row = screen.getByRole('button', { name: /^Mon 23/ })
    fireEvent.click(row)
    const dock = screen.getByRole('dialog', { name: 'Mon 23' })
    fireEvent.pointerLeave(row, { pointerType: 'mouse' })
    expect(screen.getByRole('dialog')).toBe(dock)
    fireEvent.click(within(dock).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(row)
    fireEvent.click(row)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
