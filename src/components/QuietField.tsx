import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretDown, CaretLeft, CaretRight, CaretUp } from '@phosphor-icons/react'
import type { Game, GameLine } from '../api/client'
import { nbaAbbrev } from '../lib/filmRoom'
import { isIR } from '../lib/myPlayers'
import type { PlayerRow, Totals } from '../lib/myPlayers'
import { minutesDelta, nightGrade, signed } from '../lib/nightGrade'
import type { Category, NightGrade } from '../lib/nightGrade'
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
  head,
  children,
}: {
  /** The field's starters: the counts above the scroller come from them. */
  starters: PlayerRow[]
  pager: boolean
  /** The line above the scroller, in place of the plain counts (My Players' status line). */
  head?: ReactNode
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
  // The box is the size container the phone name measure reads (100cqw), for the rows and the snap alike.
  return (
    <div className="tm-slidebox">
      <div className="tm-slide-head">
        <span className="tm-slide-counts">{head ?? counts.join(' · ')}</span>
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
    </div>
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
function stateOf(r: PlayerRow, now: number, tagged = false): { node: ReactNode; words: string } {
  const g = r.game
  if (!g) return { node: 'No game', words: 'no game today' }
  if (r.state === 'later' || (r.state === 'live' && !r.line)) {
    // The OUT tag already sits after his name: line 2 says his team plays without him.
    if (OUT.has(r.spot.injury_status) && tagged)
      return {
        node: (
          <>
            Not playing
            <span className="tm-wmid">
              {' '}
              · {r.state === 'live' ? gameScore(r, g) : `${myAbbrev(r, g)} ${tipOff(g.start)}`}
            </span>
          </>
        ),
        words: 'not playing',
      }
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
/** "MIA 104–111", his side first. The club joins from 1200: at 760–1199 the clock and score fill the line. */
function gameScore(r: PlayerRow, g: Game) {
  const [a, b] = mySideOf(r, g)
  return (
    <>
      <span className="tm-wide">{a.abbrev} </span>
      {a.score ?? 0}–{b.score ?? 0}
    </>
  )
}
function result(r: PlayerRow, g: Game) {
  const [a, b] = mySideOf(r, g)
  if (a.score == null || b.score == null) return ''
  return `${a.score > b.score ? 'W' : 'L'} ${a.score}–${b.score}`
}

/** A rated row's why: a tap anywhere off the face and name opens it under the row. */
export interface RowWhy {
  id: string
  open: boolean
  toggle: () => void
  /** The tap's spoken name ("What 55% means for Tatum"). */
  label: string
  body: ReactNode
}

/** What My Players adds to a row; Today passes none of it. */
export interface RowExtras {
  /** After the name on line 1: the injury-report tag (Q, D, DTD, OUT). */
  tag?: ReactNode
  /** Line 2 in place of the game's state ("Swap now · ruled out tonight", "Missed 11 · 10% next game"). */
  status?: ReactNode
  /** After the game's state on line 2 ("covers Tatum"). */
  also?: ReactNode
  /** A row without figures: line 3 on phones, the note on the MIN edge from 760. Replaces "usually …". */
  note?: ReactNode
  /** The note only from 760 (phones say it on line 2). */
  noteWide?: boolean
  /** "usually 8 PTS · 3 REB · 2 AST" before tip-off (on by default). */
  usual?: boolean
  /** Final rows: a caret on the stats that moved the grade, and minutes against his average under MIN. */
  detail?: boolean
  /** Ruled out tonight: his face at half. */
  dim?: boolean
  why?: RowWhy
}

export function Row({
  row: r,
  names,
  bench = false,
  left = false,
  quiet = false,
  tag,
  status,
  also,
  note,
  noteWide = false,
  usual: showUsual = true,
  detail = false,
  dim = false,
  why,
}: {
  row: PlayerRow
  names: Map<string, string>
  bench?: boolean
  left?: boolean
  quiet?: boolean
} & RowExtras) {
  const now = Date.now()
  const l = r.line
  const grade = r.state === 'final' ? nightGrade(l) : null
  const st = stateOf(r, now, !!tag)
  // Out with his team playing: the game is on, but he isn't.
  const out = !l && OUT.has(r.spot.injury_status)
  const live = r.state === 'live' && !out
  // Live: filled gold while he's on the floor, hollow while he sits. The words say the rest.
  const mark: Mark | null = live ? (l?.on_court === false ? 'sitting' : 'oncourt') : null
  const avg = r.spot.season_avg
  const card = !!l && l.minutes > 0
  const usual = !card && showUsual && r.state === 'later' && !!avg && !quiet
  const noteNode = card
    ? null
    : (note ??
      (usual ? (
        <>
          usually {Math.round(avg!.pts)} PTS · {Math.round(avg!.reb)} REB · {Math.round(avg!.ast)} AST
        </>
      ) : null))
  // Phones: a row with a note reads in three short lines, the note under the game line.
  const three = !!noteNode && !noteWide
  const drivers =
    detail && grade
      ? new Map<Category, Drive>(grade.drivers.map((d) => [d.cat, d.z > 0 ? 'up' : 'down']))
      : undefined
  const minD = detail && r.state === 'final' && l ? minutesDelta(l.minutes, r.spot.season_avg?.min) : null
  const cls = [
    'tm-row',
    card ? 'tm-card' : '',
    live ? 'tm-livex' : '',
    !r.game ? 'tm-nogame' : '',
    r.state === 'final' || r.state === 'dnp' ? 'tm-final' : '',
    three ? 'tm-usual' : '',
    // no figures: the words may run on over the empty stat area instead of clipping under the pin
    card ? '' : 'tm-q',
    grade ? `tm-g-${grade.tier}` : '',
    bench ? 'tm-benchrow' : '',
    bench && !quiet && r.state === 'later' ? 'tm-plays' : '',
    left ? 'tm-left' : '',
    quiet ? 'tm-quietrow' : '',
    dim ? 'tm-dim' : '',
    why ? 'tm-whyable' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const short = names.get(r.spot.name) ?? r.spot.name
  const player = { id: r.spot.player_id, name: r.spot.name }
  const line2 =
    status ??
    (quiet ? null : left ? (
      <span className="tm-tag tm-bench-tag">Left on bench</span>
    ) : (
      <>
        {mark && (
          <span className={`tm-mk ${mark}`} title={MARK_WORD[mark]}>
            <span className="sr-only">{MARK_WORD[mark]}</span>
          </span>
        )}
        {st.node}
        {also}
      </>
    ))
  return (
    <>
      <li>
        <div className={cls} data-tm-p={left ? r.spot.player_id : undefined} tabIndex={left ? -1 : undefined}>
          {why && (
            <button
              type="button"
              className="tm-why-hit"
              aria-expanded={why.open}
              aria-controls={why.id}
              onClick={why.toggle}
            >
              <span className="sr-only">{why.label}</span>
            </button>
          )}
          <span className="tm-spine" aria-hidden={!grade}>
            {!quiet && !bench && <span className="tm-slot">{r.spot.slot}</span>}
            {grade && <Grade g={grade} />}
          </span>
          <span className="tm-who">
            {/* Face, name and game line are one button (44px+) that opens the player card. */}
            <PlayerLink player={player} className="tm-pick">
              <PlayerHead player={player} size={26} team={nbaAbbrev(r.spot.pro_team_id)} />
              <span className="tm-txt">
                <span className="tm-l1">
                  <span className="tm-nm">
                    <span className="tm-short">{short}</span>
                    <span className="tm-init">{initialName(r.spot.name)}</span>
                  </span>
                  {tag}
                </span>
                {line2 ? (
                  <span className="tm-l2">
                    <span className="tm-st">{line2}</span>
                  </span>
                ) : !tag && isIR(r.spot) && OUT.has(r.spot.injury_status) ? (
                  <span className="tm-l2">
                    <span className="tm-tag tm-out">OUT</span>
                  </span>
                ) : null}
              </span>
            </PlayerLink>
          </span>
          {card ? (
            <StatCells line={l!} drivers={drivers} minDelta={minD} />
          ) : (
            <span className={`tm-note${noteWide ? ' tm-note-wide' : ''}`}>{noteNode}</span>
          )}
        </div>
      </li>
      {why && (
        <li id={why.id} className="tm-why" hidden={!why.open}>
          {why.body}
        </li>
      )}
    </>
  )
}

type Drive = 'up' | 'down'

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

const DRIVE_WORD: Record<Drive, string> = { up: ', helped most', down: ', hurt most' }

/**
 * One line's ten figures. Each carries its column for screen readers (the column head is decorative).
 * Final rows on My Players add a 7px caret on what moved the grade and the minutes against his average.
 */
export function StatCells({
  line: l,
  drivers,
  minDelta = null,
}: {
  line: GameLine | Totals
  drivers?: Map<Category, Drive>
  minDelta?: number | null
}) {
  const min = 'minutes' in l ? l.minutes : l.min
  const cell = (label: string, cat: Category | null, v: number, main: ReactNode = v, under?: ReactNode, cls = '') => {
    const d = cat ? drivers?.get(cat) : undefined
    const c = [cls, v === 0 && !under && !d ? 'tm-z' : '', d ? `tm-drv tm-drv-${d}` : ''].filter(Boolean).join(' ')
    return (
      <span key={label} className={c || undefined}>
        <span className="sr-only">{label} </span>
        {main}
        {d && (
          <>
            <i aria-hidden="true">{d === 'up' ? <CaretUp weight="fill" /> : <CaretDown weight="fill" />}</i>
            <span className="sr-only">{DRIVE_WORD[d]}</span>
          </>
        )}
        {under}
      </span>
    )
  }
  return (
    <span className="num tm-stats">
      {cell(
        'MIN',
        null,
        min,
        min,
        minDelta !== null ? (
          <small className="tm-md">
            {signed(minDelta)}
            <span className="sr-only"> minutes against his average</span>
          </small>
        ) : undefined,
      )}
      {cell('FG', 'FG', l.fga, `${l.fgm}/${l.fga}`, <small>{ratio(l.fgm, l.fga)}</small>)}
      {cell('FT', 'FT', l.fta, `${l.ftm}/${l.fta}`, <small>{ratio(l.ftm, l.fta)}</small>)}
      {cell('3PM', '3PM', l.tpm)}
      {cell('REB', 'REB', l.reb)}
      {cell('AST', 'AST', l.ast)}
      {cell('STL', 'STL', l.stl)}
      {cell('BLK', 'BLK', l.blk)}
      {cell('TO', 'TO', l.to)}
      {cell('PTS', 'PTS', l.pts, l.pts, undefined, 'tm-pts')}
    </span>
  )
}

export function Totals({ totals, label = 'Starters so far' }: { totals: Totals; label?: string }) {
  return (
    <div className="tm-tot">
      <span className="tm-tot-lab">{label}</span>
      <StatCells line={totals} />
    </div>
  )
}

/** The field's foot before anyone has played: words, not a row of zeros. */
export function TotalsBeforeTip({ firstTip, label = 'Starters so far' }: { firstTip: string | null; label?: string }) {
  return (
    <div className="tm-tot tm-tot-empty">
      <span className="tm-tot-lab">{label}</span>
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
