import type { IndexedPlayer } from '../api/client'

/** Letters NFD does not take apart: the rest (ć, é, ü...) lose their marks below. */
const EXTRA: Record<string, string> = {
  đ: 'd',
  ø: 'o',
  ł: 'l',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ı: 'i',
}

/** A name folded for matching ("Jokić" -> "jokic"), and for each folded letter the index of the
 * letter it came from, so a match can be marked on the name as written. */
export function fold(text: string): { folded: string; from: number[] } {
  let folded = ''
  const from: number[] = []
  Array.from(text).forEach((ch, i) => {
    const lower = ch.toLowerCase()
    const plain = EXTRA[lower] ?? lower.normalize('NFD').replace(/[̀-ͯ]/g, '')
    for (const c of plain) {
      folded += c
      from.push(i)
    }
  })
  return { folded, from }
}

/** What a typed query is matched as: folded, with dots and apostrophes gone ("o'neale", "p.j."). */
function clean(text: string): string {
  return fold(text).folded.replace(/[.'’]/g, '').replace(/\s+/g, ' ').trim()
}

interface Entry {
  player: IndexedPlayer
  folded: string
  from: number[]
  /** Where each word starts in ``folded`` (words split on spaces and hyphens). */
  starts: number[]
}

export interface SearchIndex {
  entries: Entry[]
}

export function buildIndex(players: IndexedPlayer[]): SearchIndex {
  const entries = players.map((player) => {
    // Dots and apostrophes are dropped from the folded name, keeping the map to the name as written.
    const raw = fold(player.name)
    let folded = ''
    const from: number[] = []
    for (let i = 0; i < raw.folded.length; i++) {
      if (/[.'’]/.test(raw.folded[i])) continue
      folded += raw.folded[i]
      from.push(raw.from[i])
    }
    const starts: number[] = []
    for (let i = 0; i < folded.length; i++) {
      if (/[a-z0-9]/.test(folded[i]) && (i === 0 || /[\s-]/.test(folded[i - 1]))) starts.push(i)
    }
    return { player, folded, from, starts }
  })
  return { entries }
}

/** A stretch of the name as written to mark as matched: [start, end). */
export type Mark = [number, number]

export interface Hit {
  player: IndexedPlayer
  /** 0 his name starts with it, 1 a word does (or every typed word starts one), 2 his initials, 3 anywhere. */
  rank: number
  marks: Mark[]
}

function mark(e: Entry, at: number, length: number): Mark {
  const end = at + length - 1
  return [e.from[at], e.from[end] + 1]
}

function matchEntry(e: Entry, q: string, words: string[]): Hit | null {
  if (e.folded.startsWith(q)) return { player: e.player, rank: 0, marks: [mark(e, 0, q.length)] }
  const word = e.starts.find((s) => e.folded.startsWith(q, s))
  if (word !== undefined) return { player: e.player, rank: 1, marks: [mark(e, word, q.length)] }
  if (words.length > 1) {
    // "le ja": each typed word starts a different word of his name, in order.
    const marks: Mark[] = []
    let next = 0
    for (const w of words) {
      const s = e.starts.find((st, k) => k >= next && e.folded.startsWith(w, st))
      if (s === undefined) break
      marks.push(mark(e, s, w.length))
      next = e.starts.indexOf(s) + 1
    }
    if (marks.length === words.length) return { player: e.player, rank: 1, marks }
  }
  if (q.length >= 2 && words.length === 1 && e.starts.length >= q.length) {
    // "sga": Shai Gilgeous-Alexander.
    const firsts = e.starts.map((s) => e.folded[s]).join('')
    if (firsts.startsWith(q))
      return {
        player: e.player,
        rank: 2,
        marks: e.starts.slice(0, q.length).map((s) => mark(e, s, 1)),
      }
  }
  const at = e.folded.indexOf(q)
  if (at >= 0 && q.length >= 2) return { player: e.player, rank: 3, marks: [mark(e, at, q.length)] }
  return null
}

/** The best matches for what was typed: name starts first, then word starts, initials, anywhere;
 * ties go to the more widely rostered player. Empty for an empty query. */
export function search(index: SearchIndex, query: string, limit = 8): Hit[] {
  const q = clean(query)
  if (!q) return []
  const words = q.split(' ')
  const hits: Hit[] = []
  for (const e of index.entries) {
    const hit = matchEntry(e, q, words)
    if (hit) hits.push(hit)
  }
  hits.sort(
    (a, b) =>
      a.rank - b.rank || b.player.percent_owned - a.player.percent_owned || a.player.name.localeCompare(b.player.name),
  )
  return hits.slice(0, limit)
}

/** The name cut into plain and marked pieces, for rendering. */
export function pieces(name: string, marks: Mark[]): { text: string; marked: boolean }[] {
  const chars = Array.from(name)
  const sorted = [...marks].sort((a, b) => a[0] - b[0])
  const out: { text: string; marked: boolean }[] = []
  let at = 0
  for (const [s, e] of sorted) {
    if (s > at) out.push({ text: chars.slice(at, s).join(''), marked: false })
    if (e > Math.max(s, at))
      out.push({
        text: chars.slice(Math.max(s, at), e).join(''),
        marked: true,
      })
    at = Math.max(at, e)
  }
  if (at < chars.length) out.push({ text: chars.slice(at).join(''), marked: false })
  return out
}

const RECENT_MAX = 5

function recentKey(leagueId: number, season: number) {
  return `player-search-recent:${leagueId}:${season}`
}

/** The players last opened from search in this league, newest first. Empty when storage is off. */
export function readRecent(leagueId: number, season: number): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(recentKey(leagueId, season)) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is number => Number.isInteger(x)).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

/** Puts a player first in this league's recent list; returns the new list. */
export function pushRecent(leagueId: number, season: number, playerId: number): number[] {
  const next = [playerId, ...readRecent(leagueId, season).filter((id) => id !== playerId)].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(recentKey(leagueId, season), JSON.stringify(next))
  } catch {
    // private mode or storage full: the list just isn't kept
  }
  return next
}

export function clearRecent(leagueId: number, season: number) {
  try {
    localStorage.removeItem(recentKey(leagueId, season))
  } catch {
    // nothing kept, nothing to clear
  }
}

export type OwnerFilter = 'all' | 'free' | 'taken' | 'yours'

export function ownerKind(p: IndexedPlayer, myTeamId: number | null): Exclude<OwnerFilter, 'all'> {
  if (p.owner_team_id == null) return 'free'
  return p.owner_team_id === myTeamId ? 'yours' : 'taken'
}
