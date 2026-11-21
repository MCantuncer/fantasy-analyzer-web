// Our Estimates: the sportsbook's lines (iddaa, through nesine) beside ours, and once the games are final, what
// happened. Each side is judged against the result, never by which side of iddaa's line it fell
// (Can 2026-11-21: "we're trying to match the actual score"). The server judges; this file shapes
// its answer into the page's rows.

export type Closer = 'ours' | 'book' | 'tie'

interface Judged {
  ours: number | null
  book: number | null
  actual: number | null
  gap: number | null
  ours_hit: boolean | null
  book_hit: boolean | null
  closer: Closer | null
}

export interface ComparePlayer extends Judged {
  name: string
  player_id: number | null
  team: string
  stat: 'three_pm' | 'reb' | 'ast' | 'stl' | 'blk' | 'pts'
  played: boolean | null
  ladder: [number, number][]
}

export interface CompareMarket extends Judged {
  market: 'winner' | 'margin' | 'total' | 'team_pts'
  team: string
  book_team: string
  won: string
}

export interface CompareGame {
  game_id: number
  away: string
  home: string
  tip: string
  checked: string
  status: 'scheduled' | 'live' | 'final'
  away_score: number | null
  home_score: number | null
  markets: CompareMarket[]
  players: ComparePlayer[]
}

export interface CompareTally {
  stat: string
  lines: number
  compared: number
  median_gap: number | null
  ours_above: number
  judged: number
  ours_hits: number
  book_hits: number
  ours_closer: number
  book_closer: number
  level: number
  ours_miss: number | null
  book_miss: number | null
}

export interface BookCompare {
  season: number
  day: number | null
  date: string | null
  days: number[]
  nights: { day: number; date?: string | null; games: number }[]
  bands: Record<string, number>
  look: { checked: string | null; ok: boolean | null; error: string | null; games: number; matched: number }
  games: CompareGame[]
  tally: CompareTally[]
}

export type Stat = '3PM' | 'REB' | 'AST' | 'STL' | 'BLK' | 'PTS' | 'WIN' | 'MAR' | 'TOT' | 'TEAM'
export const PLAYER_STATS: Stat[] = ['3PM', 'REB', 'AST', 'STL', 'BLK', 'PTS'] // the site's stat order
export const GAME_STATS: Stat[] = ['WIN', 'MAR', 'TOT', 'TEAM']
export const STAT_NAME: Record<Stat, string> = {
  '3PM': '3PM',
  REB: 'Rebounds',
  AST: 'Assists',
  STL: 'Steals',
  BLK: 'Blocks',
  PTS: 'Points',
  WIN: 'Winner',
  MAR: 'Margin',
  TOT: 'Total',
  TEAM: 'Team points',
}
export const STAT_UNIT: Record<Stat, string> = {
  '3PM': 'threes',
  REB: 'rebounds',
  AST: 'assists',
  STL: 'steals',
  BLK: 'blocks',
  PTS: 'points',
  WIN: '',
  MAR: 'points',
  TOT: 'points',
  TEAM: 'points',
}
const FROM_API: Record<string, Stat> = {
  three_pm: '3PM',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  pts: 'PTS',
  winner: 'WIN',
  margin: 'MAR',
  total: 'TOT',
  team_pts: 'TEAM',
}
const BAND_KEY: Record<Stat, string> = {
  '3PM': 'three_pm',
  REB: 'reb',
  AST: 'ast',
  STL: 'stl',
  BLK: 'blk',
  PTS: 'pts',
  WIN: '',
  MAR: 'margin',
  TOT: 'total',
  TEAM: 'team_pts',
}
/** Winner gaps are chances: 20 points of chance count as one band when ranking. */
export const WIN_BAND = 0.2
/** A row's band grows to full width at this share of a band (the same scale on the field). */
export const FULL_AT = 0.6

export function statOf(key: string): Stat {
  return FROM_API[key] ?? 'PTS'
}

export function bandOf(stat: Stat, bands: Record<string, number>): number {
  return stat === 'WIN' ? WIN_BAND : (bands[BAND_KEY[stat]] ?? 1)
}

/** One row of the page: a player's stat or one of a game's markets. */
export interface Line {
  id: string
  kind: 'player' | 'game'
  stat: Stat
  name: string // the player, or "MIL @ PHI"
  initials: string
  playerId: number | null // the ESPN id, for the headshot
  team: string // the player's team; a market's pick or side
  game: CompareGame
  gameLabel: string
  ours: number | null
  book: number | null
  actual: number | null
  gap: number | null
  score: number // gap in bands: what the All tab ranks by
  oursHit: boolean | null
  bookHit: boolean | null
  closer: Closer | null
  by: number | null // how much nearer the closer side was
  band: number
  bookTeam: string // winner: iddaa's favourite
  won: string // winner: who won
  other: string // margin: the other team
  ladder: [number, number][]
  played: boolean | null
  tipped: boolean
}

function initials(name: string): string {
  const words = name.replace(/\./g, '').split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase()
}

/** Every row of the night, in the server's order; ranking is the list's job. */
export function linesOf(data: BookCompare, now: Date): Line[] {
  const out: Line[] = []
  for (const g of data.games) {
    const gameLabel = `${g.away} @ ${g.home}`
    const tipped = g.status !== 'scheduled' || new Date(g.tip) <= now
    for (const p of g.players) {
      const stat = statOf(p.stat)
      out.push(make(`${g.game_id}-${p.name}-${p.stat}`, 'player', stat, p.name, p.team, g, gameLabel, p, data.bands, tipped, {
        ladder: p.ladder ?? [],
        played: p.played,
        playerId: p.player_id,
      }))
    }
    for (const m of g.markets) {
      const stat = statOf(m.market)
      const other = m.team === g.home ? g.away : g.home
      out.push(
        make(`${g.game_id}-${m.market}-${m.team}`, 'game', stat, gameLabel, m.team, g, gameLabel, m, data.bands, tipped, {
          bookTeam: m.book_team,
          won: m.won,
          other,
        }),
      )
    }
  }
  return out
}

function make(
  id: string,
  kind: 'player' | 'game',
  stat: Stat,
  name: string,
  team: string,
  game: CompareGame,
  gameLabel: string,
  j: Judged,
  bands: Record<string, number>,
  tipped: boolean,
  extra: Partial<Line>,
): Line {
  const band = bandOf(stat, bands)
  let by: number | null = null
  if (j.closer && j.closer !== 'tie') {
    if (stat === 'WIN') by = j.ours != null && j.book != null ? Math.abs(j.ours - j.book) : null
    else if (j.actual != null && j.ours != null && j.book != null)
      by = Math.abs(Math.abs(j.actual - j.ours) - Math.abs(j.actual - j.book))
  }
  return {
    id,
    kind,
    stat,
    name,
    initials: kind === 'player' ? initials(name) : '',
    playerId: null,
    team,
    game,
    gameLabel,
    ours: j.ours,
    book: j.book,
    actual: j.actual,
    gap: j.gap,
    score: j.gap == null ? 0 : j.gap / band,
    oursHit: j.ours_hit,
    bookHit: j.book_hit,
    closer: j.closer,
    by,
    band,
    bookTeam: '',
    won: '',
    other: '',
    ladder: [],
    played: null,
    tipped,
    ...extra,
  }
}

/** Rows with both numbers, split into Ours above iddaa (biggest first) and the rest (biggest the
 *  other way first). All ranks by gap in bands; a single stat by the raw gap. */
export function ranked(lines: Line[], byBands: boolean): { above: Line[]; rest: Line[] } {
  const both = lines.filter((l) => l.gap != null)
  const key = (l: Line) => (byBands ? l.score : (l.gap ?? 0))
  return {
    above: both.filter((l) => (l.gap ?? 0) > 0).sort((a, b) => key(b) - key(a)),
    rest: both.filter((l) => (l.gap ?? 0) <= 0).sort((a, b) => key(a) - key(b)),
  }
}

export interface Tally {
  n: number
  judged: number
  ours: number
  book: number
  oursCloser: number
  bookCloser: number
  level: number
  above: number
  oursMiss: number | null
  bookMiss: number | null
}

/** The page's own count over any set of rows (the server's per-stat tally covers whole stats). */
export function tallyOf(lines: Line[]): Tally {
  const t: Tally = { n: 0, judged: 0, ours: 0, book: 0, oursCloser: 0, bookCloser: 0, level: 0, above: 0, oursMiss: null, bookMiss: null }
  let mo = 0
  let mb = 0
  let nm = 0
  for (const l of lines) {
    if (l.gap == null) continue
    t.n++
    if (l.gap > 0) t.above++
    if (l.oursHit == null && l.bookHit == null) continue
    t.judged++
    if (l.oursHit) t.ours++
    if (l.bookHit) t.book++
    if (l.closer === 'ours') t.oursCloser++
    else if (l.closer === 'book') t.bookCloser++
    else if (l.closer === 'tie') t.level++
    if (l.stat !== 'WIN' && l.actual != null && l.ours != null && l.book != null) {
      mo += Math.abs(l.actual - l.ours)
      mb += Math.abs(l.actual - l.book)
      nm++
    }
  }
  if (nm) {
    t.oursMiss = mo / nm
    t.bookMiss = mb / nm
  }
  return t
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const MINUS = '−'

/** A number with one decimal when it has one: 228.5, 12, −3.5. */
export function num(v: number): string {
  const a = Math.abs(v)
  const s = Number.isInteger(Math.round(a * 10) / 10) ? String(Math.round(a)) : (Math.round(a * 10) / 10).toFixed(1)
  return (v < 0 ? MINUS : '') + s
}

/** A gap with its sign always shown: +1.3, −0.4, 0.0; chances in points of chance (+3pp). */
export function signed(v: number, stat: Stat): string {
  if (stat === 'WIN') {
    const pp = Math.round(v * 100)
    return `${pp > 0 ? '+' : pp < 0 ? MINUS : ''}${Math.abs(pp)}pp`
  }
  const r = Math.round(v * 10) / 10
  return `${r > 0 ? '+' : r < 0 ? MINUS : ''}${Math.abs(r).toFixed(1)}`
}

/** 21:00 in the viewer's own time. */
export function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "Sat 21 Nov" for a US game date. */
export function nightLabel(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Short tab name: "Fri 20". */
export function nightTab(date: string | null | undefined): string {
  const l = nightLabel(date)
  return l.split(' ').slice(0, 2).join(' ')
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const CLOSER: Record<Closer, string> = { ours: 'we were closer', book: 'the book was closer', tie: 'both as close' }

/** One line in plain words, for the row under a name: what we expect against the book before the
 *  game, what happened and who was nearer after it. */
export function plain(l: Line, settled: boolean): string {
  const unit = STAT_UNIT[l.stat]
  if (settled) {
    if (l.stat === 'WIN') return l.won ? `${l.won} won, so our pick was ${l.oursHit ? 'right' : 'wrong'}` : ''
    if (l.actual == null) return l.played === false ? "didn't play" : ''
    const near = l.closer ? `, ${CLOSER[l.closer]}` : ''
    if (l.stat === 'MAR') return `${l.actual >= 0 ? l.team : l.other} won by ${num(Math.abs(l.actual))}${near}`
    if (l.stat === 'TOT') return `${num(l.actual)} points in all${near}`
    if (l.stat === 'TEAM') return `${l.team} scored ${num(l.actual)}${near}`
    return `finished with ${num(l.actual)} ${l.actual === 1 ? unit.replace(/s$/, '') : unit}${near}`
  }
  if (l.ours == null || l.book == null) return l.ours == null ? 'no number of ours for him' : ''
  const gap = l.gap ?? 0
  switch (l.stat) {
    case 'WIN':
      return l.bookTeam && l.bookTeam !== l.team
        ? `we pick ${l.team} (${pct(l.ours)}), the book picks ${l.bookTeam}`
        : `we give ${l.team} ${pct(l.ours)} to win, the book ${pct(l.book)}`
    case 'MAR': {
      const side = (v: number) => `${v >= 0 ? l.team : l.other} by ${num(Math.abs(v))}`
      const same = l.ours >= 0 === l.book >= 0
      return `we see ${side(l.ours)}, the book ${same ? `by ${num(Math.abs(l.book))}` : side(l.book)}`
    }
    case 'TOT':
      return `we expect ${num(l.ours)} points in all, the book ${num(l.book)}`
    case 'TEAM':
      return `we expect ${l.team} to score ${num(l.ours)}, the book ${num(l.book)}`
    default:
      if (Math.abs(gap) < 0.05) return `we expect the same as the book`
      return `we expect ${num(Math.abs(gap))} ${gap > 0 ? 'more' : 'fewer'} ${unit} than the book`
  }
}

/** A game in two or three plain sentences: who wins and by how much, and the total. */
export function gameStory(lines: Line[], settled: boolean): string {
  const get = (s: Stat) => lines.find((l) => l.stat === s)
  const say = (l: Line | undefined) => (l ? plain(l, settled) : '')
  const parts = [say(get('WIN')), say(get('MAR')), say(get('TOT'))].filter(Boolean)
  return parts.map((p) => p[0].toUpperCase() + p.slice(1) + '.').join(' ')
}
