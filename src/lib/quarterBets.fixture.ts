import type { CompareGame, QuarterBet } from './iddaaCompare'

const side = (s: string, odd: number, ours: number, book: number) => ({
  side: s as 'over',
  odd,
  ours,
  book,
  value: Math.round((ours * odd - 1) * 1000) / 1000,
})

/** MIL @ PHI with the brief's numbers: before the game (settled = false) or after it. */
export function quarterBets(settled: boolean): QuarterBet[] {
  const done = <T extends object>(b: T, actual: number, result: string, hit: boolean | null) =>
    settled ? { ...b, actual, result, hit } : { ...b, actual: null, result: null, hit: null }
  return [
    done(
      {
        market: 'q_total',
        period: 1,
        line: 56.5,
        ours: 56,
        sides: [side('under', 1.7, 0.524, 0.5), side('over', 1.7, 0.476, 0.5)],
        pick: 'under',
        edge: -0.109,
      },
      53,
      'under',
      true,
    ),
    done(
      {
        market: 'q_winner',
        period: 1,
        line: null,
        ours: 4,
        sides: [side('home', 1.6, 0.66, 0.58), side('tie', 13, 0.04, 0.07), side('away', 2.2, 0.3, 0.35)],
        pick: 'home',
        edge: 0.056,
      },
      13,
      'home',
      true,
    ),
    done(
      {
        market: 'q_winner',
        period: 4,
        line: null,
        ours: 1.5,
        sides: [side('home', 1.3, 0.55, 0.7), side('away', 2.9, 0.4, 0.3)],
        pick: null,
        edge: null,
      },
      -2,
      'away',
      null,
    ),
    done(
      {
        market: 'h1_margin',
        period: 0,
        line: -3.5,
        ours: 8,
        sides: [side('home', 1.7, 0.653, 0.49), side('away', 1.65, 0.347, 0.51)],
        pick: 'home',
        edge: 0.11,
      },
      18,
      'home',
      true,
    ),
    done(
      {
        market: 'h1_home',
        period: 0,
        line: 60.5,
        ours: 61,
        sides: [side('under', 1.7, 0.47, 0.49), side('over', 1.62, 0.53, 0.51)],
        pick: 'over',
        edge: -0.141,
      },
      63,
      'over',
      true,
    ),
  ] as QuarterBet[]
}

export const MIL_PHI: Pick<CompareGame, 'away' | 'home'> = { away: 'MIL', home: 'PHI' }
