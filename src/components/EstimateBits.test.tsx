import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { COUPONS, couponsOf, kuponKey, kuponPicksOf } from '../lib/coupons'
import type { CouponSlot } from '../lib/coupons'
import { linesOf } from '../lib/iddaaCompare'
import type { BookCompare, CompareGame, CompareMarket, Line } from '../lib/iddaaCompare'
import { Chance, KuponTag, useKuponPicks } from './EstimateBits'

afterEach(cleanup)

describe('Chance', () => {
  it('prints the number first and keeps the bar out of the accessibility tree', () => {
    const { container } = render(<Chance value={0.604} />)
    expect(container.querySelector('.ic-ch b')?.textContent).toBe('60%')
    const bar = container.querySelector('.ic-ch-bar') as HTMLElement
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect((bar.firstElementChild as HTMLElement).style.getPropertyValue('--ic-ch')).toBe('60%')
  })

  it('keeps the bar inside 0 to 100', () => {
    const { container } = render(<Chance value={1.4} />)
    expect(container.querySelector('.ic-ch b')?.textContent).toBe('100%')
  })
})

describe('KuponTag', () => {
  it('says Kupon on screen and names the slip for screen readers', () => {
    render(<KuponTag kupons={['Highest Confidence']} />)
    expect(screen.getByText('Kupon').tagName).toBe('I')
    expect(screen.getByText('On the Highest Confidence Kupon')).toBeTruthy()
  })

  it('names the slips when asked', () => {
    render(<KuponTag kupons={['Highest Confidence', 'Matches Only']} named />)
    expect(screen.getByText('Highest Confidence · Matches Only')).toBeTruthy()
    expect(screen.getByText('On the Highest Confidence and Matches Only Kupons')).toBeTruthy()
  })

  it('shows nothing for a bet on no Kupon', () => {
    const { container } = render(<KuponTag kupons={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('kuponKey', () => {
  it("is a game line's id, or a player's rung", () => {
    expect(kuponKey({ id: 'g1-MAR', kind: 'game' })).toBe('g1-MAR')
    expect(kuponKey({ id: 'p7-REB', kind: 'player' }, 8)).toBe('p7-REB-8')
  })
})

const win = (team: string, ours: number, pick: number): CompareMarket => ({
  market: 'winner',
  team,
  book_team: team,
  won: '',
  ours,
  book: 0.6,
  actual: null,
  gap: ours - 0.6,
  ours_hit: null,
  book_hit: null,
  closer: null,
  odds: [
    { side: 'pick', odd: pick },
    { side: 'other', odd: 2.4 },
  ],
})

const game = (id: number, away: string, home: string, m: CompareMarket): CompareGame => ({
  game_id: id,
  away,
  home,
  tip: '2026-11-23T00:00:00Z',
  checked: '',
  status: 'scheduled',
  away_score: null,
  home_score: null,
  markets: [m],
  players: [],
})

function night(): BookCompare {
  const games = [
    game(1, 'MIA', 'PHI', win('PHI', 0.74, 1.55)),
    game(2, 'IND', 'NY', win('NY', 0.71, 1.5)),
    game(3, 'BOS', 'ORL', win('BOS', 0.58, 1.8)),
    game(4, 'SAC', 'HOU', win('HOU', 0.62, 1.7)),
  ]
  return {
    season: 2027,
    day: 35,
    date: '2026-11-22',
    days: [35],
    nights: [{ day: 35, date: '2026-11-22', games: games.length }],
    bands: { pts: 5, reb: 2, ast: 2, stl: 1, blk: 1, three_pm: 1, team_pts: 8, total: 12, margin: 8 },
    look: { checked: null, ok: null, error: null, games: games.length, matched: games.length },
    games,
    tally: [],
  }
}

describe('useKuponPicks', () => {
  it("maps every leg on tonight's Kupons to the titles that carry it", () => {
    const lines: Line[] = linesOf(night(), new Date('2026-11-22T12:00:00Z'))
    const slots = couponsOf(lines)
    const { result } = renderHook(() => useKuponPicks(lines))
    const legs = slots.flatMap((s) => s.coupon?.legs ?? [])
    expect(legs.length).toBeGreaterThan(0)
    for (const leg of legs) {
      const titles = slots.filter((s) => s.coupon?.legs.some((l) => l.id === leg.id)).map((s) => s.spec.title)
      expect(result.current.get(kuponKey(leg.line, leg.kind === 'player' ? leg.at : null))).toEqual(titles)
    }
    // a game line that is no leg carries no tag
    const off = lines.find((l) => !legs.some((leg) => leg.id === l.id))
    if (off) expect(result.current.get(off.id)).toBeUndefined()
  })

  it('works the search out once per night', () => {
    const lines = linesOf(night(), new Date('2026-11-22T12:00:00Z'))
    const { result, rerender } = renderHook(({ l }) => useKuponPicks(l), { initialProps: { l: lines } })
    const first = result.current
    rerender({ l: lines })
    expect(result.current).toBe(first)
  })

  it('adds a merged slip once per title, in the page order', () => {
    const leg = { id: 'g1-WIN' } as NonNullable<CouponSlot['coupon']>['legs'][number]
    const slot = (i: number): CouponSlot => ({
      spec: COUPONS[i],
      coupon: { legs: [leg, leg] } as CouponSlot['coupon'],
      why: null,
      same: null,
    })
    expect(kuponPicksOf([slot(0), slot(2)]).get('g1-WIN')).toEqual(['Highest Confidence', 'Matches Only'])
  })
})
