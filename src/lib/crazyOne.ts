import type { CrazyGame, CrazyRecord } from '../api/client'

/* Crazy One: a persona that believes what fans believe and the data backs on average, but not in every
   season (api app/tunings.py STORY). Its numbers live only in its own world, always named "Crazy One's
   call", never Our call. Everything here turns POST /api/crazy-one into words and marks. */

export type BeliefKey = 'rivalry' | 'bounce' | 'slump' | 'tank' | 'one_man'

export interface Belief {
  key: BeliefKey
  name: string
  /** What it believes, in its own voice. */
  creed: string
  /** The weight, in plain words. */
  weight: string
  /** How often it held, from the research it stands on. */
  held: string
  /** Seasons it held of those measured, for the pips (none where it was never counted by season). */
  pips?: [number, number]
}

export const BELIEFS: Belief[] = [
  {
    key: 'rivalry',
    name: 'Rivalry stack',
    creed: 'A fallen contender in a slump, facing a team it met in the last two playoffs, plays like it’s May.',
    weight: '+12 wins per 100 (+3 when the other side’s star sits)',
    held: 'Beat the book in 13 of 15 seasons',
    pips: [13, 15],
  },
  {
    key: 'bounce',
    name: 'Favourite bounce',
    creed: 'A favourite that lost three in a row gets angry, not worse.',
    weight: '+0.65 points on the margin, +2.1 when favoured by 6 or more',
    held: 'Held in 6 of 8 seasons',
    pips: [6, 8],
  },
  {
    key: 'slump',
    name: 'Slumping strong team',
    creed: 'A good team in a bad run is closer to its real level than the run says.',
    weight: '+0.5 points on the margin',
    held: 'Fails on its own; a fan’s hunch',
  },
  {
    key: 'tank',
    name: 'Tankers sink late',
    creed: 'After game 55, bad teams stop caring before the book notices.',
    weight: '−1.5 points on the margin, under .350 after 55 games',
    held: 'Under the book 5 of 5 recent seasons (not older ones)',
    pips: [5, 5],
  },
  {
    key: 'one_man',
    name: 'Two one-man shows',
    creed:
      'When both teams run their shots through one or two players, defenses load up on them and the game comes in low.',
    weight: '−1 point off the game’s total (the total, not the winner)',
    held: 'Under Our call’s total in 4 of 5 seasons',
    pips: [4, 5],
  },
]

/** A belief's team code is empty when it moves the game's total, not the winner (api tunings.TOTAL). */
export function onTotal(b: { team: string }): boolean {
  return b.team === ''
}

/** Whether a game has a belief that moves the winner (a total-only game still agrees on who wins). */
export function movesWinner(g: Pick<CrazyGame, 'beliefs'>): boolean {
  return g.beliefs.some((b) => !onTotal(b))
}

/** Its total against Our call's, when a belief moved the total: { ours, crazy }. */
export function totals(g: CrazyGame): { ours: number; crazy: number } | null {
  if (!g.beliefs.some(onTotal)) return null
  return { ours: g.ours.away + g.ours.home, crazy: g.crazy.away + g.crazy.home }
}

/** A fan belief Crazy One tested and refuses: what fans say, and what the data said. */
export interface Myth {
  name: string
  /** What a fan says, in a fan's words. */
  says: string
  /** What the test found. */
  data: string
}

export type MythKind = 'player' | 'game'

/** Myths about players: who will go off tonight. Each was tested on past seasons and failed. */
export const PLAYER_MYTHS: Myth[] = [
  {
    name: 'Revenge game',
    says: 'A star who just had a bad loss comes back angry.',
    data: 'Top-25 scorers scored 0.8 under their level the next game, below normal in 7 of 8 seasons.',
  },
  {
    name: 'Contract year',
    says: 'Players go off in the season before a new deal.',
    data: '0.65 fewer points a game, lower in 11 of 11 seasons. The ones who reach the market are losing their role.',
  },
  {
    name: '“He’s due”',
    says: 'A cold player is about to heat up.',
    data: 'Cold leads to cold: after a bad game, the next one runs slightly worse.',
  },
  {
    name: 'Soft defense tonight',
    says: 'A scorer booms against a bad defense.',
    data: 'No more booms than expected against the softest defenses, and fewer in 3 of 5 seasons.',
  },
  {
    name: 'Size mismatch',
    says: 'A big man feasts on a team with no true center.',
    data: 'Nothing for centers in points, rebounds or blocks over 5 seasons. Coaches go small too.',
  },
  {
    name: 'His time of year',
    says: 'He always plays better after the All-Star break.',
    data: 'Personal rhythms don’t repeat: season to season they line up at +0.04, about chance.',
  },
  {
    name: 'Hometown game',
    says: 'He goes off in front of family.',
    data: 'Looked real in 5 seasons, then held in only 4 of 7 older ones: luck.',
  },
  {
    name: 'Big-game temperament',
    says: 'Some players rise to the moment.',
    data: 'Personal temperament is noise: 0 of 20 tests held, and it doesn’t repeat season to season.',
  },
]

/** Myths about games: who wins, and by how much. Each was tested on past seasons and failed. */
export const GAME_MYTHS: Myth[] = [
  {
    name: 'Win-streak complacency',
    says: 'A favourite on a 5-game win streak gets lazy.',
    data: 'Its sign flips by season, from −3.3 to +1.7 points on the margin.',
  },
  {
    name: 'Payback rematch',
    says: 'A team blown out last time wins the rematch.',
    data: 'Rematches after a 15+ point loss play like any other game.',
  },
  {
    name: 'Style clashes',
    says: 'A fast team runs a slow one off the floor.',
    data: 'Pace, shooting, turnover and rebounding matchups swing by season with weights that flip.',
  },
  {
    name: 'Strength of schedule',
    says: 'Adjust every team for who it has played.',
    data: 'Worse than plain recent form in every season: the schedule evens out fast.',
  },
  {
    name: 'Coach vs coach',
    says: 'Some coaches have a rival’s number.',
    data: 'Head-to-head and in-series adjustments fail over 30,000 games, 2002 to 2027.',
  },
  {
    name: 'Tired legs',
    says: 'The third game in four nights, or a long road trip, drags a team down.',
    data: 'Rest days, 3 in 4 nights and road trip length found no weight in 5 seasons.',
  },
  {
    name: 'The referee crew',
    says: 'This crew calls everything.',
    data: 'Free throws move a hair, and the sign flips by season.',
  },
]

export function beliefOf(key: string): Belief | undefined {
  return BELIEFS.find((b) => b.key === key)
}

/** "62%" */
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}

/** One decimal with its sign: "+1.4", "−0.6" (a true minus). */
export function signed(x: number, digits = 1): string {
  const v = Number(x.toFixed(digits))
  if (v === 0) return (0).toFixed(digits)
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
}

/** The team a call backs and by how much: { team, by }. */
export function leanOf(call: { away: number; home: number }, g: Pick<CrazyGame, 'away' | 'home'>) {
  const margin = call.home - call.away
  return margin >= 0 ? { team: g.home, by: margin } : { team: g.away, by: -margin }
}

/** The team Crazy One moves toward and how far, in wins per 100 (from Our call's chance). */
export function swingOf(g: CrazyGame): { team: string; per100: number } {
  return g.swing >= 0 ? { team: g.home, per100: g.swing * 100 } : { team: g.away, per100: -g.swing * 100 }
}

/** A game where Crazy One and Our call pick different winners. */
export function flips(g: CrazyGame): boolean {
  return g.crazy.home_chance >= 0.5 !== g.ours.home_chance >= 0.5
}

export type RecordState = 'empty' | 'early' | 'leading' | 'behind'

/** Where its record stands: no finals yet, too early to tell, a lead (the whole range above zero), or
 *  behind (the whole range below). */
export function recordState(r: CrazyRecord): RecordState {
  if (r.games === 0) return 'empty'
  if (r.leading) return 'leading'
  if (r.edge_high != null && r.edge_high < 0) return 'behind'
  return 'early'
}

export const RECORD_WORDS: Record<RecordState, string> = {
  empty: 'No record yet. Its first calls settle after tonight’s finals.',
  early: 'Too early: the range still crosses zero, so a hit could be luck.',
  leading: 'A lead: its whole range sits above Our call.',
  behind: 'Behind: its whole range sits below Our call.',
}

/** Where a home chance sits on a 0-100% track, as a percentage from the away end. */
export function trackAt(homeChance: number): number {
  return Math.min(100, Math.max(0, homeChance * 100))
}

/** "Wed 25 Nov": the US game date of a night, from its first tip. */
export function nightOf(games: Pick<CrazyGame, 'tip'>[]): string {
  const tips = games.map((g) => g.tip).sort()
  const d = tips.length ? new Date(tips[0]) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', {
    timeZone: 'America/New_York',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Its edge over Our call, per 100 games of log loss: "+0.4". */
export function edge100(x: number | null | undefined): string {
  return x == null ? '–' : signed(x * 100)
}

/** Where the edge, its range and zero sit on one bar, as percentages across it. */
export function rangeMarks(r: Pick<CrazyRecord, 'edge' | 'edge_low' | 'edge_high'>) {
  if (r.edge == null || r.edge_low == null || r.edge_high == null) return null
  const reach = Math.max(Math.abs(r.edge_low), Math.abs(r.edge_high), 1e-9) * 1.15
  const at = (x: number) => 50 + (x / reach) * 50
  return { low: at(r.edge_low), high: at(r.edge_high), edge: at(r.edge), zero: 50 }
}
