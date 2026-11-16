import type { TeamResult } from '../api/client'
import { teamByAbbrev } from './teamSearch'

const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i

/** "Jokic", "Jackson" for Jaren Jackson Jr.; the full name when a teammate shares the last name. */
export function shortName(name: string, roster: string[]): string {
  const last = (n: string) => {
    const words = n.trim().split(/\s+/)
    while (words.length > 1 && SUFFIX.test(words[words.length - 1])) words.pop()
    return words[words.length - 1] ?? n
  }
  const mine = last(name)
  const shared = roster.some((other) => other !== name && last(other) === mine)
  return shared ? name : mine
}

/** "Houston", "the Lakers" (two teams share LA), or the name ESPN sent. */
function place(g: TeamResult): string {
  if (g.opponent === 'LAL') return 'the Lakers'
  if (g.opponent === 'LAC') return 'the Clippers'
  return teamByAbbrev(g.opponent)?.location ?? g.opponent_name
}

const margin = (g: TeamResult) => Math.abs(g.points - g.opponent_points)

/** "by 10 at Houston": "over" a home win, "to" a home loss, "at" away. */
function where(g: TeamResult): string {
  const prep = !g.home ? 'at' : g.won ? 'over' : 'to'
  return `by ${margin(g)} ${prep} ${place(g)}`
}

/** The smallest (or biggest) margin; a tie goes to the latest game. ``games`` run oldest first. */
function pickBy(games: TeamResult[], biggest: boolean): TeamResult {
  return games.reduce((best, g) => {
    const d = margin(g) - margin(best)
    return (biggest ? d >= 0 : d <= 0) ? g : best
  })
}

function count(n: number): string {
  return n === 2 ? 'both' : `all ${n}`
}

function run(games: TeamResult[]): string {
  const n = games.length
  const wins = games.filter((g) => g.won)
  const losses = games.filter((g) => !g.won)
  if (n === 1) return `${games[0].won ? 'Won' : 'Lost'} their first game ${where(games[0])}`
  if (!losses.length) return `Won ${count(n)}, the closest ${where(pickBy(wins, false))}`
  if (!wins.length) return `Lost ${count(n)}, the closest ${where(pickBy(losses, false))}`
  if (losses.length === 1) return `Won ${wins.length} of ${n}, the only loss ${where(losses[0])}`
  if (wins.length === 1) return `Lost ${losses.length} of ${n}, the only win ${where(wins[0])}`
  const winning = wins.length >= losses.length
  const head = winning ? `Won ${wins.length} of ${n}` : `Lost ${losses.length} of ${n}`
  const last = games[n - 1].won
  let k = 0
  for (let i = n - 1; i >= 0 && games[i].won === last; i--) k++
  if (k >= 2 && last === winning) return `${head}, the last ${k} in a row`
  if (k >= 2) return `${head} but ${last ? 'won' : 'dropped'} the last ${k}`
  return winning
    ? `${head}, the biggest ${where(pickBy(wins, true))}`
    : `${head}, the worst ${where(pickBy(losses, true))}`
}

function scorer(games: TeamResult[], roster: string[]): string | null {
  const tops = games.flatMap((g) => (g.top ? [g.top] : []))
  if (!tops.length) return null
  const tally = new Map<number, { name: string; games: number; pts: number }>()
  for (const t of tops) {
    const s = tally.get(t.player_id) ?? { name: t.name, games: 0, pts: 0 }
    s.games += 1
    s.pts += t.pts
    tally.set(t.player_id, s)
  }
  const lead = [...tally.values()].sort((a, b) => b.games - a.games || b.pts - a.pts)[0]
  const name = (n: string) => shortName(n, roster)
  if (games.length >= 3 && lead.games === games.length) return `with ${name(lead.name)} their top scorer every game`
  if (lead.games >= 3) return `with ${name(lead.name)} their top scorer in ${lead.games}`
  const best = tops.reduce((a, b) => (b.pts > a.pts ? b : a))
  return `with ${name(best.name)}'s ${best.pts} their best night`
}

/**
 * One plain sentence on the last five games, built by rules: the run (with its closest, only or
 * biggest result) and who scored. ``latest`` comes most recent first, as the API sends it; ``roster``
 * is the team's player names, so two players sharing a last name go by their full names.
 * Null before the first game.
 */
export function teamComment(latest: TeamResult[], roster: string[] = []): string | null {
  // A level score is a box still missing lines, not a result: NBA games don't tie.
  const games = latest.filter((g) => g.points !== g.opponent_points).reverse()
  if (!games.length) return null
  const head = run(games)
  const who = games.length > 1 ? scorer(games, roster) : null
  return `${head}${who ? `, ${who}` : ''}.`
}

/** "Won 2 straight", "Lost the last game"; null before the first game. */
export function streakText(streak: string | null | undefined): string | null {
  const m = streak?.match(/^([WL])(\d+)$/)
  if (!m) return null
  const won = m[1] === 'W'
  const n = Number(m[2])
  if (n === 1) return won ? 'Won the last game' : 'Lost the last game'
  return `${won ? 'Won' : 'Lost'} ${n} straight`
}
