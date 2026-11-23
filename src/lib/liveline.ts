// Live line in the box score of a game in progress (Can 2026-11-23): where each player's points land at the
// end of regulation, from his line at tip-off, his night so far and the score (api app/liveline.py).
// Pure helpers only. No betting words.
import type { LivePlayerLine, LiveLines } from '../api/client'

/** A side's rows, biggest finish first. */
export function sideRows(data: LiveLines, team: number): LivePlayerLine[] {
  return data.lines.filter((l) => l.pro_team_id === team).sort((a, b) => b.final - a.final || b.pts - a.pts)
}

/** The scale every track in a side shares: room for the biggest finish, line or score so far, in whole 5s. */
export function scaleOf(rows: LivePlayerLine[]): number {
  const top = Math.max(10, ...rows.flatMap((r) => [r.final, r.line_pts, r.pts]))
  return Math.ceil((top + 1) / 5) * 5
}

/** "+4" / "−3" / "on it": his finish against his line at tip-off, whole points. */
export function vsLine(r: LivePlayerLine): { text: string; dir: 'up' | 'down' | 'even' } {
  const d = Math.round(r.final) - Math.round(r.line_pts)
  if (Math.abs(d) < 1) return { text: 'on it', dir: 'even' }
  return { text: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, dir: d > 0 ? 'up' : 'down' }
}

/** The honesty line under the rows, for this point of the game. */
export function honesty(data: LiveLines): string {
  const h = data.half_within.toFixed(1)
  const m = data.most_within.toFixed(1)
  return `At this point half of finals land within ${h} points of our number; 8 in 10 within ${m}.`
}

/** What a screen reader hears after a row's name. */
export function rowSentence(r: LivePlayerLine): string {
  const v = vsLine(r)
  const against = v.dir === 'even' ? 'on his line' : `${v.text} against his line of ${Math.round(r.line_pts)}`
  return `${r.pts} now, ends about ${Math.round(r.final)}, ${against}.`
}
