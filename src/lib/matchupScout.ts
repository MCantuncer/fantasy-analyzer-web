import type { ManagerStyleRow, ManagerStyles, MatchupCall } from '../api/client'
import { listCats } from './managerStyles'
import { CATEGORY_ORDER } from './statOrder'

/** League → Your matchup: the scouting report on this week's opponent, built from the API's weekly calls. */

export type MatchBand = 'hold' | 'go' | 'let_go'

export interface MatchCell {
  cat: string
  band: MatchBand
  call: MatchupCall['call']
  status: MatchupCall['status']
  /** Our margin, signed so that + is good (TO counts lower as better): "+.079", "-13", "±0". */
  margin: string
  /** Both totals, ours first: ".562 · .483". */
  totals: string
  /** Weeks this opponent won the category, out of ``weeks``. */
  theirWon: number
  weeks: number
}

const PCT = new Set(['FG%', 'FT%'])

function value(cat: string, v: number) {
  return PCT.has(cat) ? v.toFixed(3).replace(/^0/, '') : String(Math.round(v))
}

/** Our edge in a category, + when we are winning it. TO: fewer is better. */
export function edge(c: Pick<MatchupCall, 'cat' | 'mine' | 'theirs'>): number | null {
  if (c.mine == null || c.theirs == null) return null
  return c.cat === 'TO' ? c.theirs - c.mine : c.mine - c.theirs
}

export function signed(cat: string, d: number) {
  const tiny = PCT.has(cat) ? Math.abs(d) < 0.0005 : Math.round(d) === 0
  if (tiny) return '±0'
  const s = PCT.has(cat) ? Math.abs(d).toFixed(3).replace(/^0/, '') : String(Math.round(Math.abs(d)))
  return `${d > 0 ? '+' : '−'}${s}`
}

/** The nine calls in the site order, each in its band: Hold the leads, Go after the flips, Let go of the rest. */
export function matchBoard(data: ManagerStyles, them: ManagerStyleRow): MatchCell[] {
  const order: readonly string[] = CATEGORY_ORDER
  const record = new Map(them.categories.map((c) => [c.cat, c]))
  return [...(data.matchup?.calls ?? [])]
    .sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat))
    .map((c) => {
      const d = edge(c)
      const rec = record.get(c.cat)
      return {
        cat: c.cat,
        band: c.call === 'hold' ? 'hold' : c.call === 'let_go' ? 'let_go' : 'go',
        call: c.call,
        status: c.status,
        margin: d == null ? '–' : signed(c.cat, d),
        totals:
          c.mine == null || c.theirs == null ? 'no stats yet' : `${value(c.cat, c.mine)} · ${value(c.cat, c.theirs)}`,
        theirWon: rec?.won ?? 0,
        weeks: rec?.weeks ?? 0,
      }
    })
}

const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** "Hold the four we lead, flip BLK and REB." + "That's 6–3 if both land." */
export function matchHeadline(board: MatchCell[]): {
  plan: string
  go: string
  result: string
} {
  const hold = board.filter((c) => c.band === 'hold')
  const go = board.filter((c) => c.band === 'go')
  const allFlips = go.length > 0 && go.every((c) => c.call === 'flip')
  const goCats = listCats(go.map((c) => c.cat))
  const live = board.some((c) => c.status !== 'not_started')
  const plan = hold.length
    ? live
      ? `Hold the ${COUNT_WORD[hold.length] ?? hold.length} we lead${go.length ? ',' : '.'}`
      : `Hold ${listCats(hold.map((c) => c.cat))}${go.length ? ',' : '.'}`
    : ''
  const goText = go.length
    ? `${hold.length ? '' : 'Go '}${allFlips ? 'flip' : hold.length ? 'go after' : 'after'} ${goCats}.`
    : ''
  const ours = hold.length + go.length
  const land = go.length === 1 ? 'it lands' : go.length === 2 ? 'both land' : 'they all land'
  const result = go.length
    ? `That's ${ours}–${board.length - ours} if ${land}.`
    : `That's ${ours}–${board.length - ours}.`
  return { plan, go: goText, result }
}

/** Who to start for a category: the plays speak in roles, not stat names. */
const ROLE: Record<string, string> = {
  REB: 'a big',
  BLK: 'a big',
  AST: 'a guard',
  STL: 'a guard',
  '3PM': 'a shooter',
  PTS: 'a scorer',
  'FG%': 'an efficient big',
  'FT%': 'a good free-throw shooter',
  TO: 'a low-turnover player',
}

export interface Play {
  title: string
  body: string
  cats: string[]
}

/** Three plays for the week: chase the flips, protect the leads, stop paying for the rest. */
export function gamePlan(board: MatchCell[]): Play[] {
  const hold = board.filter((c) => c.band === 'hold')
  const go = board.filter((c) => c.band === 'go')
  const letGo = board.filter((c) => c.band === 'let_go')
  const majority = Math.floor(board.length / 2) + 1
  const plays: Play[] = []
  if (go.length) {
    const roles = [...new Set(go.map((c) => ROLE[c.cat]).filter(Boolean))]
    plays.push({
      title: `Start ${roles[0] ?? 'the right players'} with games left`,
      body: `${listCats(go.map((c) => c.cat))} ${go.length > 1 ? 'are' : 'is'} the cheapest way to ${majority} of ${board.length}.${
        go.some((c) => c.margin === '±0') ? ' A tie flips on one good night.' : ''
      }`,
      cats: go.map((c) => c.cat),
    })
  }
  const to = hold.find((c) => c.cat === 'TO')
  if (to) {
    plays.push({
      title: 'Keep TO clean',
      body: `We're ${to.margin} in turnovers${to.theirWon === 0 ? ', a category they never win' : ''}. No high-turnover adds this week.`,
      cats: ['TO'],
    })
  } else if (hold.length) {
    plays.push({
      title: `Protect ${listCats(hold.map((c) => c.cat))}`,
      body: 'Keep starting the players who built these leads; a late add can give one back.',
      cats: hold.map((c) => c.cat),
    })
  }
  if (letGo.length) {
    const theirs = letGo.filter((c) => c.weeks && c.theirWon / c.weeks >= 0.8)
    plays.push({
      title: `Don't chase ${listCats(letGo.map((c) => c.cat))}`,
      body: `${
        theirs.length
          ? `${listCats(theirs.map((c) => c.cat))} ${theirs.length > 1 ? 'are' : 'is'} theirs most weeks. `
          : ''
      }${go.length ? `Every add there is one not spent on ${listCats(go.map((c) => c.cat))}.` : 'Spend the adds on the leads.'}`,
      cats: letGo.map((c) => c.cat),
    })
  }
  return plays
}

/** "4 weeks in 5", "every week", "never". */
export function weeksIn(won: number, weeks: number) {
  if (won === weeks) return 'every week'
  if (won === 0) return 'never'
  return `${Number.isInteger(won) ? won : won.toFixed(1)} weeks in ${weeks}`
}
