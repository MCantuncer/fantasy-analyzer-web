import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { Game, GameLine } from '../api/client'
import { nbaAbbrev } from '../lib/filmRoom'
import { isIR } from '../lib/myPlayers'
import type { PlayerRow, Totals } from '../lib/myPlayers'
import { nightGrade } from '../lib/nightGrade'
import type { NightGrade } from '../lib/nightGrade'
import { ratio, tipOff } from '../lib/scores'
import { STAT_COLUMNS } from '../lib/statOrder'
import { initialName } from '../lib/todayMatchup'
import { PlayerLink } from './PlayerCard'
import { PlayerHead } from './PlayerHead'
import './QuietField.css'

/*
 * Quiet Field: the row primitives a lineup is drawn with (Today, and My Players next). The starters and
 * their total sit on one soft field, the bench on the bare page; no row has a box, a fill or a line.
 * Rows sit inside a `.tm` wrapper, which carries the field's tokens (QuietField.css).
 */

const MINUTE = 60_000

/** The starters and their total on one soft field: a sticky backdrop, so its corners never scroll away. */
export function Field({ children }: { children: ReactNode }) {
  return (
    <div className="tm-field">
      <span className="tm-field-bg" aria-hidden="true" />
      {children}
    </div>
  )
}

/**
 * One team's full stat lines on a phone: the names stay pinned on the left and PTS on the right, the
 * columns between slide sideways, and ‹ › page them for anyone who doesn't swipe.
 */
export function Slide({
  starters,
  pager,
  children,
}: {
  /** The field's starters: the counts above the scroller come from them. */
  starters: PlayerRow[]
  pager: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState<{ start: boolean; end: boolean }>({ start: true, end: false })
  const read = useCallback(() => {
    const el = ref.current
    if (!el) return
    setAt({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
  }, [])
  useEffect(() => {
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [read])
  const page = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * el.clientWidth * 0.5, behavior: reduce ? 'auto' : 'smooth' })
  }
  const playing = starters.filter((r) => r.state === 'live' && r.line).length
  const later = starters.filter((r) => r.state === 'later').length
  const done = starters.filter((r) => r.state === 'final').length
  const counts = [playing && `${playing} live`, later && `${later} to come`, done && `${done} final`].filter(Boolean)
  return (
    <>
      <div className="tm-slide-head">
        <span className="tm-slide-counts">{counts.join(' · ')}</span>
        {pager && !(at.start && at.end) && (
          <span className="tm-pager">
            <button
              type="button"
              className="icon-button"
              aria-label="Earlier stats"
              disabled={at.start}
              onClick={() => page(-1)}
            >
              <CaretLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="More stats"
              disabled={at.end}
              onClick={() => page(1)}
            >
              <CaretRight size={18} aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
      <div className={`tm-slide${at.start ? '' : ' tm-slid'}${at.end ? '' : ' tm-more'}`} ref={ref} onScroll={read}>
        {children}
      </div>
    </>
  )
}

export function ColumnHead() {
  return (
    <div className="tm-colhead" aria-hidden="true">
      <span className="tm-ch-pin" />
      {STAT_COLUMNS.map((c) => (
        <span key={c} className={c === 'PTS' ? 'tm-pts' : undefined}>
          {c === 'TO' ? 'TO↓' : c}
        </span>
      ))}
    </div>
  )
}

const OUT = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION'])

/** "Q4 3:41", "FINAL", "12:00 AM", "Tips in 15 min", "No game", "OUT": what his game is doing. */
function stateOf(r: PlayerRow, now: number): { node: ReactNode; words: string } {
  const g = r.game
  if (!g) return { node: 'No game', words: 'no game today' }
  if (r.state === 'later' || (r.state === 'live' && !r.line)) {
    if (OUT.has(r.spot.injury_status))
      return {
        node: (
          <>
            <span className="tm-tag tm-out">OUT</span>
            <span className="tm-w400"> · {myAbbrev(r, g)} playing</span>
          </>
        ),
        words: 'out',
      }
  }
  if (r.state === 'later') {
    const mins = Math.ceil((new Date(g.start).getTime() - now) / MINUTE)
    const when = mins > 0 && mins <= 60 ? `Tips in ${mins} min` : tipOff(g.start)
    return {
      node: (
        <>
          {when}
          <span className="tm-w400"> {vs(r, g)}</span>
        </>
      ),
      words: `tips ${when}`,
    }
  }
  if (r.state === 'live')
    return {
      node: (
        <>
          <span className="tm-clk">{g.clock ?? 'Live'}</span>
          <span className="tm-wmid"> · {gameScore(r, g)}</span>
        </>
      ),
      words: `live, ${g.clock ?? ''}`,
    }
  return {
    node: (
      <>
        {/* Plain words, no chip. Phones keep the score (W/L says it's over); "Final" joins it from 760. */}
        {r.state === 'dnp' ? (
          <>
            <span className="tm-wmid">Did not play · {result(r, g)}</span>
            <span className="tm-nmid">DNP</span>
          </>
        ) : (
          <>
            <span className="tm-wmid">Final ·</span>
            <span>{result(r, g)}</span>
          </>
        )}
      </>
    ),
    words: r.state === 'dnp' ? 'did not play' : 'final',
  }
}

function mySideOf(r: PlayerRow, g: Game) {
  return g.home.pro_team_id === r.spot.pro_team_id ? [g.home, g.away] : [g.away, g.home]
}
function myAbbrev(r: PlayerRow, g: Game) {
  return mySideOf(r, g)[0].abbrev
}
function vs(r: PlayerRow, g: Game) {
  const [, opp] = mySideOf(r, g)
  return `${g.home.pro_team_id === r.spot.pro_team_id ? 'vs' : '@'} ${opp.abbrev}`
}
function gameScore(r: PlayerRow, g: Game) {
  const [a, b] = mySideOf(r, g)
  return `${a.abbrev} ${a.score ?? 0}–${b.score ?? 0}`
}
function result(r: PlayerRow, g: Game) {
  const [a, b] = mySideOf(r, g)
  if (a.score == null || b.score == null) return ''
  return `${a.score > b.score ? 'W' : 'L'} ${a.score}–${b.score}`
}

export function Row({
  row: r,
  names,
  bench = false,
  left = false,
  quiet = false,
}: {
  row: PlayerRow
  names: Map<string, string>
  bench?: boolean
  left?: boolean
  quiet?: boolean
}) {
  const now = Date.now()
  const l = r.line
  const grade = r.state === 'final' ? nightGrade(l) : null
  const st = stateOf(r, now)
  // Out with his team playing: the game is on, but he isn't.
  const out = !l && OUT.has(r.spot.injury_status)
  const live = r.state === 'live' && !out
  // Live: filled gold while he's on the floor, hollow while he sits. The words say the rest.
  const mark: Mark | null = live ? (l?.on_court === false ? 'sitting' : 'oncourt') : null
  const avg = r.spot.season_avg
  const card = !!l && l.minutes > 0
  const usual = !card && r.state === 'later' && !!avg && !quiet
  const cls = [
    'tm-row',
    card ? 'tm-card' : '',
    live ? 'tm-livex' : '',
    !r.game ? 'tm-nogame' : '',
    r.state === 'final' || r.state === 'dnp' ? 'tm-final' : '',
    usual ? 'tm-usual' : '',
    grade ? `tm-g-${grade.tier}` : '',
    bench ? 'tm-benchrow' : '',
    left ? 'tm-left' : '',
    quiet ? 'tm-quietrow' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const short = names.get(r.spot.name) ?? r.spot.name
  const player = { id: r.spot.player_id, name: r.spot.name }
  return (
    <li>
      <div className={cls} data-tm-p={left ? r.spot.player_id : undefined} tabIndex={left ? -1 : undefined}>
        <span className="tm-spine" aria-hidden={!grade}>
          {!quiet && <span className="tm-slot">{r.spot.slot}</span>}
          {grade && <Grade g={grade} />}
        </span>
        <span className="tm-who">
          <PlayerLink player={player} decorative>
            <PlayerHead player={player} size={26} team={nbaAbbrev(r.spot.pro_team_id)} />
          </PlayerLink>
          <span className="tm-txt">
            <span className="tm-l1">
              <PlayerLink player={player} className="tm-nm">
                <span className="tm-short">{short}</span>
                <span className="tm-init">{initialName(r.spot.name)}</span>
              </PlayerLink>
            </span>
            {!quiet ? (
              <span className="tm-l2">
                <span className="tm-st">
                  {left ? (
                    <span className="tm-tag tm-bench-tag">Left on bench</span>
                  ) : (
                    <>
                      {mark && (
                        <span className={`tm-mk ${mark}`} title={MARK_WORD[mark]}>
                          <span className="sr-only">{MARK_WORD[mark]}</span>
                        </span>
                      )}
                      {st.node}
                    </>
                  )}
                </span>
              </span>
            ) : isIR(r.spot) && OUT.has(r.spot.injury_status) ? (
              <span className="tm-l2">
                <span className="tm-tag tm-out">OUT</span>
              </span>
            ) : null}
          </span>
        </span>
        {card ? (
          <StatCells line={l!} />
        ) : usual ? (
          <span className="tm-note">
            usually {Math.round(avg!.pts)} PTS · {Math.round(avg!.reb)} REB · {Math.round(avg!.ast)} AST
          </span>
        ) : (
          <span className="tm-note" />
        )}
      </div>
    </li>
  )
}

type Mark = 'oncourt' | 'sitting'
const MARK_WORD: Record<Mark, string> = {
  oncourt: 'On the floor now',
  sitting: 'On the bench now',
}

export function Grade({ g }: { g: NightGrade }) {
  return (
    <span className={`tm-grade ${g.tier}`} aria-label={`grade ${g.grade}`}>
      {g.letter}
      {g.mod && <sup>{g.mod}</sup>}
    </span>
  )
}

export function StatCells({ line: l }: { line: GameLine | Totals }) {
  const z = (v: number) => (v === 0 ? 'tm-z' : undefined)
  const min = 'minutes' in l ? l.minutes : l.min
  return (
    <span className="num tm-stats">
      <span className={z(min)}>{min}</span>
      <span>
        {l.fgm}/{l.fga}
        <small>{ratio(l.fgm, l.fga)}</small>
      </span>
      <span>
        {l.ftm}/{l.fta}
        <small>{ratio(l.ftm, l.fta)}</small>
      </span>
      <span className={z(l.tpm)}>{l.tpm}</span>
      <span className={z(l.reb)}>{l.reb}</span>
      <span className={z(l.ast)}>{l.ast}</span>
      <span className={z(l.stl)}>{l.stl}</span>
      <span className={z(l.blk)}>{l.blk}</span>
      <span className={z(l.to)}>{l.to}</span>
      <span className="tm-pts">{l.pts}</span>
    </span>
  )
}

export function Totals({ totals }: { totals: Totals }) {
  return (
    <div className="tm-tot">
      <span className="tm-tot-lab">Starters so far</span>
      <StatCells line={totals} />
    </div>
  )
}

/** The field's foot before anyone has played: words, not a row of zeros. */
export function TotalsBeforeTip({ firstTip }: { firstTip: string | null }) {
  return (
    <div className="tm-tot tm-tot-empty">
      <span className="tm-tot-lab">Starters so far</span>
      <span className="tm-tot-note">
        {firstTip ? `Nothing yet · first tip ${tipOff(firstTip)}` : 'No starters play today'}
      </span>
    </div>
  )
}

export function EmptyRow({ slot }: { slot: string }) {
  return (
    <li>
      <div className="tm-row tm-empty">
        <span className="tm-spine" aria-hidden="true">
          <span className="tm-slot">{slot}</span>
        </span>
        <span className="tm-who">
          <span className="tm-head-hole" aria-hidden="true" />
          <span className="tm-txt">
            <span className="tm-l1">
              <span className="tm-nm tm-empty-name">Empty slot</span>
            </span>
          </span>
        </span>
        <span className="tm-note" />
      </div>
    </li>
  )
}
