import type { CrazyBoom, CrazyBoomRecord, CrazyGame } from '../api/client'
import { movesWinner } from './crazyOne'

/* Crazy One hunts booms (api app/booms.py): the players he thinks go way over their line tonight, the
   beliefs behind each call, and his record of booms caught against what Our chance expected of the same
   calls. Everything here turns POST /api/crazy-one's `booms` and `boom_record` into words, places and
   marks. */

export type BoomStat = CrazyBoom['stat']
export type BoomBeliefKey = 'hot' | 'swings' | 'minutes' | 'done_it'
export type Filter = 'all' | BoomStat

/** Seasons of the blind replay, oldest first; the last is this season so far. */
export const SEASONS = ['21-22', '22-23', '23-24', '24-25', '25-26', '26-27'] as const

export interface BoomBelief {
  key: BoomBeliefKey
  name: string
  /** What he believes, in his own voice. */
  creed: string
  /** How it held, in words. */
  held: string
  /** Booms seen over booms Our chance expected, among the players highest on this belief (the top
   *  fifth), each season of SEASONS. Points and rebounds where it was believed for that stat. */
  seasons: Partial<Record<BoomStat, readonly number[]>>
}

export const BOOM_BELIEFS: BoomBelief[] = [
  {
    key: 'hot',
    name: 'Hot hand',
    creed: 'Three games well over his line, and the next one keeps more of the heat than his line says.',
    held: 'More points booms than expected in 5 of 5 seasons',
    seasons: { pts: [1.1, 1.08, 1.05, 1.1, 1.04, 0.95] },
  },
  {
    key: 'swings',
    name: 'Wild swings',
    creed: 'A scorer whose nights jump around has a higher ceiling than his average shows.',
    held: 'More booms than expected in 5 of 5 seasons, points and rebounds',
    seasons: {
      pts: [1.07, 1.07, 1.12, 1.09, 1.09, 1.21],
      reb: [1.21, 1.19, 1.25, 1.38, 1.36, 1.04],
    },
  },
  {
    key: 'minutes',
    name: 'Minutes rollercoaster',
    creed: 'When his minutes swing night to night, one of those nights runs long.',
    held: 'Points 4 of 5 seasons, rebounds 5 of 5',
    seasons: {
      pts: [0.99, 1.12, 1.12, 1.13, 1.11, 0.9],
      reb: [1.07, 1.18, 1.18, 1.39, 1.19, 0.83],
    },
  },
  {
    key: 'done_it',
    name: 'Done it lately',
    creed: 'A big who pulled a huge rebound night in his last ten can do it again.',
    held: 'More rebound booms than expected in 5 of 5 seasons',
    seasons: { reb: [1.1, 1.12, 1.2, 1.25, 1.14, 0.99] },
  },
]

export function boomBeliefOf(key: string): BoomBelief | undefined {
  return BOOM_BELIEFS.find((b) => b.key === key)
}

export const STAT_WORD: Record<BoomStat, string> = { pts: 'PTS', reb: 'REB' }
const STAT_LONG: Record<BoomStat, string> = { pts: 'points', reb: 'rebounds' }

/** One id per call: a player can be called for points and rebounds the same night. */
export function callId(b: Pick<CrazyBoom, 'game_id' | 'player' | 'stat'>): string {
  return `${b.game_id}-${b.player}-${b.stat}`
}

/** "Coby White" -> "White" (a suffix stays with the name: "Jaren Jackson Jr." -> "Jackson Jr."). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  const tail = parts[parts.length - 1]
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(tail) && parts.length > 2) return `${parts[parts.length - 2]} ${tail}`
  return tail
}

/** How much more chance of the boom he sees than Our call, in percentage points. */
export function gapOf(b: Pick<CrazyBoom, 'ours' | 'crazy'>): number {
  return (b.crazy - b.ours) * 100
}

/** One belief behind a call, in plain words from what the player did. */
export function whyWords(belief: { belief: string; value: number }, call: Pick<CrazyBoom, 'line'>): string {
  const v = belief.value
  switch (belief.belief) {
    case 'hot':
      return `${v.toFixed(1)} points a game over his last 3, on a ${call.line.toFixed(1)} line.`
    case 'swings':
      return `His points swing by ±${v.toFixed(1)} a night over his last 10.`
    case 'minutes':
      return `His minutes swing by ±${v.toFixed(1)} a night.`
    case 'done_it':
      return `He had ${Math.round(v)} rebounds in one of his last 10.`
    default:
      return ''
  }
}

/** The calls the filter keeps, most likely boom first. */
export function shown(booms: CrazyBoom[], filter: Filter): CrazyBoom[] {
  return booms
    .filter((b) => filter === 'all' || b.stat === filter)
    .sort((a, b) => b.crazy - a.crazy || a.player - b.player)
}

/** The first-person line at the top of his world. */
export function boomVoice(booms: CrazyBoom[]): string {
  if (!booms.length) return 'No boom calls for this night yet. I write mine in the last 90 minutes before each tip.'
  const settled = booms.filter((b) => b.boom != null)
  if (settled.length === booms.length) {
    const hit = settled.filter((b) => b.boom).length
    return hit === 0 ? 'None of my calls went off this night.' : `${hit} of my ${booms.length} calls went way over.`
  }
  const players = new Set(booms.map((b) => b.player)).size
  return `${players === 1 ? 'One player' : `${words(players)} players`} I think blow past their line tonight.`
}

function words(n: number): string {
  const w = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  return w[n] ?? String(n)
}

/** Where a game sits on the sky's horizon: games in tip order (then id), as 0-1 across. */
export function horizon(games: Pick<CrazyGame, 'game_id' | 'tip'>[], booms: Pick<CrazyBoom, 'game_id' | 'tip'>[]) {
  const seen = new Map<number, string>()
  for (const g of [...games, ...booms]) if (!seen.has(g.game_id)) seen.set(g.game_id, g.tip)
  const order = [...seen].sort((a, b) => a[1].localeCompare(b[1]) || a[0] - b[0]).map(([id]) => id)
  const at = new Map(order.map((id, i) => [id, (i + 0.5) / order.length]))
  return { order, at, slot: order.length ? 1 / order.length : 1 }
}

/** The sky's top, in chance: the biggest chance shown, rounded up to the next 5%, at least 10%. */
export function skyTop(booms: Pick<CrazyBoom, 'ours' | 'crazy'>[]): number {
  const top = Math.max(0.1, ...booms.flatMap((b) => [b.crazy, b.ours]))
  return Math.ceil(top * 20 - 1e-9) / 20
}

/** The sky's floor, in chance: 2 points under the smallest chance shown, rounded down to 5%, never under 0,
 *  so the stars use the whole sky instead of crowding its top. */
export function skyFloor(booms: Pick<CrazyBoom, 'ours' | 'crazy'>[]): number {
  if (!booms.length) return 0
  const low = Math.min(...booms.flatMap((b) => [b.crazy, b.ours]))
  return Math.max(0, Math.floor((low - 0.02) * 20 + 1e-9) / 20)
}

export interface Star {
  id: string
  call: CrazyBoom
  /** 0-1 across (the game's place, spread when a game has more than one call). */
  x: number
  /** 0-1 up, Crazy One's chance and Our chance, from the sky's floor to its top. */
  y: number
  ours: number
  /** The game's likeliest call: the one whose name shows without pointing at it. */
  first: boolean
}

/** Each call's place in the sky: above its game, spread across the game's slot when it has several. */
export function stars(booms: CrazyBoom[], games: Pick<CrazyGame, 'game_id' | 'tip'>[]): Star[] {
  const { at, slot } = horizon(games, booms)
  const top = skyTop(booms)
  const floor = skyFloor(booms)
  const up = (p: number) => (p - floor) / (top - floor)
  const byGame = new Map<number, CrazyBoom[]>()
  for (const b of [...booms].sort((a, c) => c.crazy - a.crazy)) {
    byGame.set(b.game_id, [...(byGame.get(b.game_id) ?? []), b])
  }
  const out: Star[] = []
  for (const [gid, calls] of byGame) {
    const mid = at.get(gid) ?? 0.5
    calls.forEach((b, i) => {
      const spread = calls.length > 1 ? (i / (calls.length - 1) - 0.5) * slot * 0.7 : 0
      out.push({ id: callId(b), call: b, x: mid + spread, y: up(b.crazy), ours: up(b.ours), first: i === 0 })
    })
  }
  return out
}

/** A belief's touches tonight: the boom calls it pushed and the games it moved. */
export function touches(key: string, booms: CrazyBoom[], games: CrazyGame[]) {
  return {
    calls: booms.filter((b) => b.beliefs.some((x) => x.belief === key)).map(callId),
    games: games.filter((g) => g.beliefs.some((x) => x.belief === key)).map((g) => g.game_id),
  }
}

/** Games where a belief moved the winner or the total: the ones that could break. */
export function surprises(games: CrazyGame[]): CrazyGame[] {
  return games.filter((g) => g.beliefs.length > 0)
}

/** Games no belief touched. */
export function calm(games: CrazyGame[]): CrazyGame[] {
  return games.filter((g) => g.beliefs.length === 0)
}

/** A surprise's tag: what kind of break it could be. */
export function surpriseTag(g: CrazyGame): string {
  if (!movesWinner(g)) return 'Low-scoring watch'
  const flipped = g.crazy.home_chance >= 0.5 !== g.ours.home_chance >= 0.5
  return flipped ? 'Upset alert' : 'Lean watch'
}

export type BoomState = 'empty' | 'early' | 'leading' | 'behind'

/** Where his booms record stands: nothing settled, too early (the range crosses zero), a lead (the
 *  whole range above zero) or behind (the whole range below). */
export function boomState(r: CrazyBoomRecord | null | undefined): BoomState {
  if (!r || r.nights === 0) return 'empty'
  if (r.leading) return 'leading'
  if (r.edge_high != null && r.edge_high < 0) return 'behind'
  return 'early'
}

export const BOOM_WORDS: Record<BoomState, string> = {
  empty: 'No settled calls yet. My first ones settle the morning after the night I call.',
  early: 'Too early: the range still crosses zero, so what I caught could be luck.',
  leading: 'A lead: the whole range sits above what Our chance expected.',
  behind: 'Behind: the whole range sits below what Our chance expected.',
}

/** Every settled call as a tally mark, newest night first. */
export function marks(r: CrazyBoomRecord | null | undefined) {
  return (r?.by_night ?? []).flatMap((n) =>
    n.picks.map((p, i) => ({
      key: `${n.day}-${p.player}-${p.stat}-${i}`,
      day: n.day,
      ...p,
    })),
  )
}

/** A season's replay number as "+10%" more (or "−5%" fewer) booms than expected. */
export function lift(x: number): string {
  const v = Math.round((x - 1) * 100)
  if (v === 0) return '0%'
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}%`
}

/** Which stat's season numbers a belief card shows first. */
export function mainStat(b: BoomBelief): BoomStat {
  return b.seasons.pts ? 'pts' : 'reb'
}

export function statLong(s: BoomStat): string {
  return STAT_LONG[s]
}
