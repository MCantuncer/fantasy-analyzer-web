// FA Targets: "does he play today?" and "when do I add him?", worked out from the Scores feed and
// the pickup's timing. Pure functions only (no React, no fetching). Rules this follows:
// - "Today" is the NBA game day the Scores feed serves; once all of its games are final, the next
//   game day is today (the same step My Players makes).
// - Tip times are shown in the viewer's own time zone (tipOff). A US night game is "tonight" even
//   when it starts after midnight where the viewer is.
// - A next game is named only from this week's fixtures (ScoreDay.week, to Sunday). Past Sunday
//   nothing is known, so nothing is said.
// - Why a wait pays comes only from the timing's own numbers: games the spot gains (days[],
//   drop_games_kept, add_games_missed) or, with no games gained, cats_best - cats_now.
import type { Game, PickupIdea, ScoreDay } from '../api/client'
import { parseClock } from './gameClock'
import { isOut, tipOff } from './scores'
import { teamName } from './nbaTeams'
import { keptDays, lastName, longDay, shortDay, spotGames, type MoveTiming } from './moveTiming'

type Side = Pick<Game, 'start' | 'away' | 'home'>
type Player = Pick<PickupIdea['add'], 'name' | 'pro_team' | 'injury_status'> & { expected_back?: string | null }

// ---------- Which day is today ----------

/** Every game of the day is over. */
export const dayOver = (games: Game[]) => games.length > 0 && games.every((g) => g.status === 'final')

/**
 * The ESPN day (scoring period) to fetch as "today": the feed's own day, or the next game day once
 * all of its games are final. Pass the feed's default day (fetched with day = null).
 */
export function todayPeriod(feed: ScoreDay): number {
  if (!dayOver(feed.games)) return feed.day
  const i = feed.days.findIndex((d) => d.day === feed.day)
  return feed.days[i + 1]?.day ?? feed.day
}

// ---------- His game today ----------

export type GameState = 'scheduled' | 'live' | 'final' | 'out' | 'none'

export interface Opponent {
  abbrev: string
  /** "vs" at home, "at" away. */
  word: 'vs' | 'at'
}

export interface NextGame extends Opponent {
  /** US date of the game, YYYY-MM-DD. */
  date: string
}

export interface TodayGame {
  state: GameState
  /** Today's game, when he has one (also when he is out). */
  game: Game | null
  opp: Opponent | null
  /** Listed out and his game is already over: he sat it out. */
  satOut: boolean
  /** Listed out: his expected first game back (YYYY-MM-DD), when ESPN's news gives one. */
  back: string | null
  /** No game today: his next one this week, or null when none is left before Sunday ends. */
  next: NextGame | null
}

const plays = (g: Side, team: string) => g.home.abbrev === team || g.away.abbrev === team

function opponent(g: Side, team: string): Opponent {
  return g.home.abbrev === team ? { abbrev: g.away.abbrev, word: 'vs' } : { abbrev: g.home.abbrev, word: 'at' }
}

/** His next game after today from this week's fixtures (Monday to Sunday). Never past Sunday. */
export function nextGameThisWeek(team: string, feed: ScoreDay): NextGame | null {
  const today = feed.date ?? ''
  for (const day of feed.week) {
    if (!day.date || day.date <= today) continue
    const g = day.games.find((x) => plays(x, team))
    if (g) return { date: day.date, ...opponent(g, team) }
  }
  return null
}

/** Today's game for an NBA team (ESPN abbrev: LAL, GS, NO, UTAH), and where he stands in it. */
export function todayGame(player: Player, feed: ScoreDay): TodayGame {
  const team = player.pro_team ?? ''
  const game = (team && feed.games.find((g) => plays(g, team))) || null
  if (!game)
    return {
      state: 'none',
      game: null,
      opp: null,
      satOut: false,
      back: null,
      next: team ? nextGameThisWeek(team, feed) : null,
    }
  const out = isOut(player.injury_status)
  return {
    state: out ? 'out' : game.status,
    game,
    opp: opponent(game, team),
    satOut: out && game.status === 'final',
    back: out ? (player.expected_back ?? null) : null,
    next: null,
  }
}

// ---------- Words ----------

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** The viewer's own hour (0-23) at an instant. */
function localHour(iso: string, timeZone?: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(new Date(iso))
  return Number(h)
}

/**
 * "tonight" or "today" for a game day's tip, in the viewer's time: a US night game tips after
 * midnight in Istanbul (3:30 AM) and is still tonight's game; a 1 PM afternoon tip is today's.
 */
export function tonight(start: string | null | undefined, timeZone?: string): 'tonight' | 'today' {
  if (!start) return 'today'
  const h = localHour(start, timeZone)
  return h >= 17 || h < 9 ? 'tonight' : 'today'
}

/** "Sat" this week, "Nov 24" further out. */
function backDay(gameDate: string, back: string): string {
  if (daysBetween(gameDate, back) <= 6) return shortDay(back)
  const [, m, d] = back.split('-').map(Number)
  return new Date(Date.UTC(2000, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** The live clock as words: "Q3 4:12", "Halftime", "End Q3". */
function clockWords(raw: string | null | undefined): string {
  const c = parseClock(raw)
  if (!c) return 'Live'
  if (c.isBreak) return c.word === 'Half' ? 'Halftime' : (c.word ?? 'Live')
  return `${c.label} ${c.time}`
}

export type TodayTone = 'plain' | 'live' | 'quiet' | 'bad'

export interface TodayCopy {
  /** Line 1: "Plays tonight", "Playing now", "Played today", "Out tonight", "Didn't play today", "No game today". */
  lead: string
  /** Line 2, opponent part: "vs" / "at" and the abbrev; null when line 2 is only words. */
  opp: Opponent | null
  /** Line 2, the rest: tip time, clock, "Final", "back Sat", "Next: Sat vs BOS", "None left this week". */
  detail: string
  tone: TodayTone
  /** The same as one sentence for screen readers. */
  said: string
}

export function todayCopy(t: TodayGame, gameDate: string, timeZone?: string): TodayCopy {
  const g = t.game
  const vs = t.opp ? `${t.opp.word} ${teamName(t.opp.abbrev)}` : ''
  if (t.state === 'none') {
    const n = t.next
    return n
      ? {
          lead: 'No game today',
          opp: null,
          detail: `Next: ${shortDay(n.date)} ${n.word} ${n.abbrev}`,
          tone: 'quiet',
          said: `No game today; next ${longDay(n.date)} ${n.word} ${teamName(n.abbrev)}`,
        }
      : {
          lead: 'No game today',
          opp: null,
          detail: 'None left this week',
          tone: 'quiet',
          said: 'No game today or later this week',
        }
  }
  const tip = g ? tipOff(g.start) : ''
  const when = tonight(g?.start, timeZone)
  switch (t.state) {
    case 'scheduled':
      return { lead: `Plays ${when}`, opp: t.opp, detail: tip, tone: 'plain', said: `Plays ${when} ${vs} at ${tip}` }
    case 'live': {
      const clock = clockWords(g?.clock)
      return { lead: 'Playing now', opp: t.opp, detail: clock, tone: 'live', said: `Playing now ${vs}, ${clock}` }
    }
    case 'final':
      return { lead: 'Played today', opp: t.opp, detail: 'Final', tone: 'quiet', said: `Played today ${vs}, final` }
    default: {
      if (t.satOut)
        return {
          lead: "Didn't play today",
          opp: t.opp,
          detail: 'Final',
          tone: 'quiet',
          said: `Listed out, didn't play today ${vs}`,
        }
      const lead = g?.status === 'live' ? 'Out today' : `Out ${when}`
      if (t.back) {
        const day = backDay(gameDate, t.back)
        return { lead, opp: null, detail: `back ${day}`, tone: 'bad', said: `Listed out ${when}, expected back ${day}` }
      }
      const detail = g?.status === 'live' ? clockWords(g.clock) : tip
      return { lead, opp: t.opp, detail, tone: 'bad', said: `Listed out ${when} ${vs}` }
    }
  }
}

// ---------- The move: add now, or wait ----------

export type MoveKind = 'now' | 'wait' | 'claim'

export interface MoveCopy {
  kind: MoveKind
  /** "Add now", "Add Monday", "Claim now", "Claim Monday". */
  verb: string
  /** Line 2: who goes out, the deadline, the reason to wait, or when a claim lands. */
  reason: string | null
  /** Under the odds in the open row: "if added Monday". */
  ifMade: string | null
  /** One sentence for screen readers. */
  said: string
  /** The open row: the whole reason, in sentences. Null when the row says it all. */
  story: string | null
}

export interface MoveContext {
  /** Today's US game date, YYYY-MM-DD (ScoreDay.date). */
  gameDate: string
  /** The drop is named once above the list (every row drops the same player). */
  sharedDrop: boolean
  /** Today's game of the added player and of the dropped one. */
  add: TodayGame
  drop: TodayGame
  timeZone?: string
}

/** The move still waits: waiting pays and its day hasn't come yet (an old report can lag the feed). */
export const waits = (t: MoveTiming | null | undefined, gameDate: string): boolean => !!t?.wait && gameDate < t.make_on

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Days the spot gains by waiting: the dropped player plays and the added one wouldn't have. */
function gainDays(t: MoveTiming): string[] {
  return keptDays(t)
    .filter((d) => !d.add_plays)
    .map((d) => d.date)
}

/** Days the spot loses by waiting: the added player plays and the dropped one doesn't. */
function lostDays(t: MoveTiming): number {
  return t.days.filter((d) => (t.next_week || d.date < t.make_on) && d.add_plays && !d.drop_plays).length
}

function catsEdge(t: MoveTiming): string {
  const d = Math.max(t.cats_best - t.cats_now, 0)
  return `+${d < 0.1 ? d.toFixed(2) : d.toFixed(1)}`
}

/** The game day said the way a person says it: "tonight" (or "today"), else "Sat" / "Saturday". */
function dayWord(date: string, ctx: MoveContext, long: boolean): string {
  if (date === ctx.gameDate) return ctx.drop.game ? tonight(ctx.drop.game.start, ctx.timeZone) : 'today'
  return long ? longDay(date) : shortDay(date)
}

function joinAnd(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** The row's one reason to wait. Games first (they are the facts), then categories. A long last
 *  name would not fit the half-slip, so the reason then goes without it (the open row names him). */
function waitReason(t: MoveTiming, drop: string, ctx: MoveContext): string {
  const g = spotGames(t)
  const n = g.best - g.now
  const fits = drop.length <= 9
  if (n > 0 && lostDays(t) === 0) {
    const days = gainDays(t).map((d) => dayWord(d, ctx, false))
    if (days.length === 1) return fits ? `${drop} plays ${days[0]}` : `+1 game ${days[0]}`
  }
  if (n > 0) return fits ? `+${plural(n, 'game')} with ${drop}` : `+${plural(n, 'game')} this week`
  return fits ? `${drop} helps more` : 'more categories'
}

/** The open row's sentences for a wait. */
function waitStory(t: MoveTiming, add: string, drop: string, ctx: MoveContext): string {
  const g = spotGames(t)
  const n = g.best - g.now
  const day = longDay(t.make_on)
  // Next morning: in Istanbul tonight's US games run past midnight, so the swap waits for them.
  const swap =
    daysBetween(ctx.gameDate, t.make_on) === 1
      ? `Add ${add} ${day}, once tonight's games are over.`
      : `Add ${add} ${day}.`
  if (n > 0) {
    const days = gainDays(t)
    const first =
      lostDays(t) === 0 && days.length > 0
        ? `${drop} plays ${joinAnd(days.map((d) => dayWord(d, ctx, true)))} first`
        : `Keeping ${drop} until ${day} adds ${plural(n, 'game')}`
    return `${first}, so this spot gets ${plural(g.best, 'game')} this week instead of ${g.now}. ${swap}`
  }
  const edge = `${catsEdge(t)} expected categories this week`
  if (n === 0 && t.days.length === 1 && ctx.add.state === 'scheduled' && ctx.drop.state === 'scheduled') {
    return `Same games either way: ${drop} and ${add} both play ${dayWord(ctx.gameDate, ctx, true)}. Keeping ${drop} for ${dayWord(ctx.gameDate, ctx, true)} is worth ${edge}${t.cats_best - t.cats_now < 0.1 ? ', a small edge' : ''}. ${swap}`
  }
  if (n === 0) {
    return `Same games either way: this spot gets ${plural(g.best, 'game')} this week whether you add ${add} now or ${day}. Keeping ${drop} until then is worth ${edge}${t.cats_best - t.cats_now < 0.1 ? ', a small edge' : ''}. ${swap}`
  }
  return `Waiting costs ${plural(-n, 'game')}: this spot gets ${g.best} instead of ${g.now}. Keeping ${drop} until ${day} is still worth ${edge}. ${swap}`
}

/** The verb and its reason for a pickup row. */
export function moveCopy(p: PickupIdea, ctx: MoveContext): MoveCopy {
  const t = p.timing
  const add = lastName(p.add.name)
  const drop = lastName(p.drop.name)
  const claim = p.availability === 'WAIVERS'
  const act = claim ? 'Claim' : 'Add'

  if (t && waits(t, ctx.gameDate)) {
    const day = longDay(t.make_on)
    const reason = waitReason(t, drop, ctx)
    const story = waitStory(t, add, drop, ctx)
    return {
      kind: 'wait',
      verb: `${act} ${day}`,
      reason,
      ifMade: `if ${claim ? 'claimed' : 'added'} ${day}`,
      said: `${act} on ${day}: ${story.replace(/\.$/, '')}`,
      story,
    }
  }

  if (claim) {
    const lands = t && t.earliest_on > ctx.gameDate ? t.earliest_on : null
    const missed = lands ? (t?.days ?? []).filter((d) => d.date < lands && d.add_plays) : []
    const onlyTonight = missed.length === 1 && missed[0].date === ctx.gameDate
    const when = tonight(ctx.add.game?.start, ctx.timeZone)
    // Row: "misses tonight"; open row: "misses tonight's game".
    const missShort = missed.length === 0 ? '' : onlyTonight ? when : plural(missed.length, 'game')
    const misses = missed.length === 0 ? '' : onlyTonight ? `${when}'s game` : plural(missed.length, 'game')
    let reason: string | null = ctx.sharedDrop ? null : `for ${drop}`
    if (lands)
      reason = ctx.sharedDrop
        ? `lands ${shortDay(lands)}${missShort ? `, misses ${missShort}` : ''}`
        : `lands ${shortDay(lands)}, for ${drop}`
    const story = lands
      ? `A claim waits for waivers to process, so ${add} joins you ${longDay(lands)}${misses ? ` and misses ${misses}` : ''}. ${drop} keeps the spot until then.`
      : null
    return {
      kind: 'claim',
      verb: 'Claim now',
      reason,
      ifMade: null,
      said: `Claim now${reason ? `, ${reason}` : ''}`,
      story,
    }
  }

  // Add now. Line 2 says who goes out; with one drop named above the list, the deadline instead.
  let reason: string | null = null
  if (!ctx.sharedDrop) reason = `for ${drop}`
  else if (ctx.add.state === 'scheduled' && ctx.add.game) reason = `before ${tipOff(ctx.add.game.start)}`
  else if (ctx.drop.state === 'none') reason = `${drop} has no game`
  else if (ctx.drop.state === 'out') reason = `${drop} is out`
  return {
    kind: 'now',
    verb: 'Add now',
    reason,
    ifMade: null,
    said: `Add now${reason ? `, ${reason}` : ''}`,
    story: null,
  }
}

/** The whole ticket as one sentence for screen readers. */
export function ticketSaid(today: TodayCopy, move: MoveCopy): string {
  return `${today.said}. ${move.said}.`
}
