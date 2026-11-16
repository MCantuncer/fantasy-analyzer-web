import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { CategoryScore, Game, GameLine } from '../api/client'
import { nbaAbbrev } from '../lib/filmRoom'
import { buildRows, isBench, isIR, starterTotals } from '../lib/myPlayers'
import type { PlayerRow, Totals } from '../lib/myPlayers'
import { nightGrade } from '../lib/nightGrade'
import type { NightGrade } from '../lib/nightGrade'
import { ratio, tipOff } from '../lib/scores'
import { STAT_COLUMNS } from '../lib/statOrder'
import type { TodayData } from '../lib/todayData'
import { chipFor, dayCategories, dayRecord, initialName, leftOnBench, shortNames } from '../lib/todayMatchup'
import type { DayCategory, LeftOnBench } from '../lib/todayMatchup'
import { Burn, emberAttrs, emberOf } from './GameTime'
import { PlayerLink } from './PlayerCard'
import { PlayerHead } from './PlayerHead'
import { Bone } from './Skeleton'
import { TeamCrest } from './TeamCrest'
import './TodayMatchup.css'

const MINUTE = 60_000

export interface TodaySide {
  id: number
  name: string
  colour: string | undefined
  /** The week's categories so far (the overview's live score, today included). */
  week: CategoryScore[]
}

interface Side extends TodaySide {
  rows: PlayerRow[]
  starters: PlayerRow[]
  open: string[]
  totals: Totals
  lob: LeftOnBench | null
  mine: boolean
}

/**
 * A matchup, today: the day's 9 categories, then one team's players at a time with their full stat
 * lines (a team switch, as in the Scores box score). Yours opens first.
 */
export function TodayMatchup({
  data,
  me,
  them,
  myId,
}: {
  data: TodayData
  /** The first side: you, in your own matchup. */
  me: TodaySide
  them: TodaySide
  myId: number | null
}) {
  const [view, setView] = useState<0 | 1>(0)
  // The bench flag's player, to bring into view once his team is on screen.
  const [seek, setSeek] = useState<number | null>(null)
  useEffect(() => {
    if (seek == null) return
    const el = document.getElementById(`tm-p-${seek}`)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    el?.focus({ preventScroll: true })
    setSeek(null)
  }, [seek, view])
  const { scores } = data
  const sides: [Side, Side] = [me, them].map((t, i) => {
    const l = data.lineups[i]
    const rows = buildRows(l.spots, scores.games)
    const starters = rows.filter((r) => r.spot.starting)
    return {
      ...t,
      rows,
      starters,
      open: l.open_slots,
      totals: starterTotals(rows),
      lob: leftOnBench(rows, l.open_slots),
      mine: t.id === myId,
    }
  }) as [Side, Side]
  const cats = dayCategories(sides[0].totals, sides[1].totals)
  const rec = dayRecord(cats)
  const names = shortNames(sides.flatMap((s) => s.rows.map((r) => r.spot.name)))
  const live = scores.games.some((g) => g.status === 'live')
  const started = scores.games.some((g) => g.status !== 'scheduled')
  const allFinal = scores.games.length > 0 && scores.games.every((g) => g.status === 'final')
  const toCome = (s: Side) => s.starters.filter((r) => r.state === 'later').length
  const weekRec = (s: TodaySide) => {
    const n = (r: string) => s.week.filter((c) => c.result === r).length
    return `${n('W')}–${n('L')}–${n('T')}`
  }
  const flag = sides[1].lob
    ? { side: sides[1], lob: sides[1].lob }
    : sides[0].lob
      ? { side: sides[0], lob: sides[0].lob }
      : null
  const shown = sides[view]

  return (
    <div className="tm">
      <p className="tm-status">
        {live ? (
          <span className="tm-live">
            <span className="tm-dot" aria-hidden="true" />
            <b>Live</b>
          </span>
        ) : allFinal ? (
          <b className="tm-final-word">Final</b>
        ) : !started && scores.games.length ? (
          <span>First tip {tipOff(scores.games.map((g) => g.start).sort()[0])}</span>
        ) : null}
        <span>
          {data.stale ? 'Updated' : 'updated'} {tipOff(scores.updated_at)}
        </span>
        {data.stale && (
          <button type="button" className="tm-retry" onClick={data.refetch}>
            Retry
          </button>
        )}
      </p>

      <div className="tm-score">
        <ScoreSide side={sides[0]} sub={started ? `${toCome(sides[0])} to come` : null} />
        <div className="tm-rec">
          <span
            className={`num tm-big${started ? '' : ' tm-quiet'}`}
            aria-label={`${rec.wins} wins, ${rec.losses} losses, ${rec.ties} ties today`}
          >
            {rec.wins}
            <i>–</i>
            {rec.losses}
            <i>–</i>
            {rec.ties}
          </span>
          <small>today · week {weekRec(me)}</small>
        </div>
        <ScoreSide side={sides[1]} sub={started ? `${toCome(sides[1])} to come` : null} theirs />
      </div>

      {flag && (
        <BenchFlag
          side={flag.side}
          lob={flag.lob}
          names={names}
          onGo={() => {
            setView(flag.side === sides[0] ? 0 : 1)
            setSeek(flag.lob.row.spot.player_id)
          }}
        />
      )}

      <ul className="tm-tiles" aria-label="Today's categories">
        {cats.map((c) => (
          <Tile key={c.stat} cat={c} week={[me.week, them.week]} sides={sides} />
        ))}
      </ul>

      <div className="tm-bar">
        <div className="segmented tm-seg" role="group" aria-label="Team">
          {sides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={view === i}
              onClick={() => setView(i as 0 | 1)}
              style={{ '--tl': s.colour ?? 'var(--accent)' } as CSSProperties}
            >
              <TeamCrest name={s.name} colour={s.colour} size={20} />
              <span className="tm-seg-name">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      <TeamColumn key={shown.id} side={shown} names={names} />
    </div>
  )
}

/** "Lakers" from "Eryaman Lakers": the last word, which is what a team goes by. */
function shortTeam(name: string): string {
  const w = name.trim().split(/\s+/)
  return w[w.length - 1]
}

function ScoreSide({ side, sub, theirs = false }: { side: Side; sub: string | null; theirs?: boolean }) {
  return (
    <div className={`tm-side${theirs ? ' theirs' : ''}`}>
      <TeamCrest name={side.name} colour={side.colour} size={32} />
      <span className="tm-side-text">
        <b>{side.mine ? 'You' : shortTeam(side.name)}</b>
        {sub && <span>{sub}</span>}
      </span>
    </div>
  )
}

function fmt(stat: string, v: number | null): string {
  if (v === null) return '–'
  if (stat === 'FG%' || stat === 'FT%') return v.toFixed(3).replace(/^0/, '')
  return String(Math.round(v))
}

function Tile({
  cat,
  week,
  sides,
}: {
  cat: DayCategory
  week: [CategoryScore[], CategoryScore[]]
  sides: [Side, Side]
}) {
  const w = week.map((cs) => cs.find((c) => c.stat === cat.stat)?.value ?? null)
  const winner = cat.result === 'W' ? sides[0] : cat.result === 'L' ? sides[1] : null
  const label = cat.stat === 'TO' ? 'TO↓' : cat.stat
  const said =
    cat.result === null
      ? `${cat.stat}: nothing yet`
      : `${cat.stat}: you ${fmt(cat.stat, cat.mine)}, them ${fmt(cat.stat, cat.theirs)}, ${
          cat.result === 'W' ? 'you lead' : cat.result === 'L' ? 'they lead' : 'tied'
        }`
  return (
    <li className={`tm-tile${cat.result ? ` ${cat.result}` : ''}`} aria-label={said}>
      <span className="tm-t1" aria-hidden="true">
        <span className="tm-lab">{label}</span>
        {winner ? (
          <TeamCrest name={winner.name} colour={winner.colour} size={18} />
        ) : cat.result === 'T' ? (
          <span className="tm-tie">Tie</span>
        ) : null}
      </span>
      <span className="num tm-v" aria-hidden="true">
        <span className={cat.result === 'W' ? 'tm-win' : undefined}>{fmt(cat.stat, cat.mine)}</span>
        <i>·</i>
        <span className={cat.result === 'L' ? 'tm-win' : undefined}>{fmt(cat.stat, cat.theirs)}</span>
      </span>
      {w[0] !== null && w[1] !== null && (
        <span className="num tm-wk" aria-hidden="true">
          {fmt(cat.stat, w[0])}
          <em>wk</em>
          {fmt(cat.stat, w[1])}
        </span>
      )}
    </li>
  )
}

function BenchFlag({
  side,
  lob,
  names,
  onGo,
}: {
  side: Side
  lob: LeftOnBench
  names: Map<string, string>
  onGo: () => void
}) {
  const l = lob.row.line!
  const chip = chipFor(l)
  const who = side.mine ? 'You' : shortTeam(side.name)
  const hole = lob.hole
    ? lob.hole.kind === 'empty'
      ? `, with ${lob.hole.slot} empty`
      : lob.hole.kind === 'out'
        ? `, with ${names.get(lob.hole.name!) ?? lob.hole.name} out at ${lob.hole.slot}`
        : `, with ${names.get(lob.hole.name!) ?? lob.hole.name} idle at ${lob.hole.slot}`
    : ''
  return (
    <button type="button" className="tm-flag" onClick={onGo}>
      <span className="tm-flag-text">
        <span className="tm-flag-lab">Left on the bench{lob.more > 0 ? ` · ${lob.more + 1} players` : ''}</span>
        {who} benched <b>{names.get(lob.row.spot.name) ?? lob.row.spot.name}</b>: {l.pts} PTS
        {chip ? `, ${chip}` : ''}
        {hole}
      </span>
      <CaretRight size={16} aria-hidden="true" />
    </button>
  )
}

function TeamColumn({ side, names }: { side: Side; names: Map<string, string> }) {
  const starters: ReactNode[] = []
  const open = [...side.open]
  for (const r of side.starters) starters.push(<Row key={r.spot.player_id} row={r} names={names} />)
  open.forEach((slot, i) => starters.push(<EmptyRow key={`open-${i}`} slot={slot} />))
  const bench = side.rows.filter((r) => isBench(r.spot))
  const left = bench.filter((r) => r.line && r.line.minutes > 0)
  const playing = bench.filter((r) => !left.includes(r) && r.state !== 'idle')
  const idle = bench.filter((r) => r.state === 'idle')
  const ir = side.rows.filter((r) => isIR(r.spot))
  return (
    <section
      className={`tm-col${side.mine ? ' mine' : ' theirs'}`}
      aria-label={side.mine ? 'Your players' : `${side.name} players`}
    >
      <Slide side={side}>
        <>
          <ColumnHead />
          <ol className="tm-list">{starters}</ol>
          <Totals totals={side.totals} />
          <h3 className="tm-sub">
            Bench <span>doesn't count</span>
          </h3>
          <ol className="tm-list tm-bench">
            {left.map((r) => (
              <Row key={r.spot.player_id} row={r} names={names} bench left />
            ))}
            {playing.map((r) => (
              <Row key={r.spot.player_id} row={r} names={names} bench />
            ))}
          </ol>
          {idle.length > 0 && (
            <>
              <p className="tm-sublab">No game</p>
              <ol className="tm-list tm-bench">
                {idle.map((r) => (
                  <Row key={r.spot.player_id} row={r} names={names} bench quiet />
                ))}
              </ol>
            </>
          )}
          {ir.length > 0 && (
            <>
              <p className="tm-sublab">IR</p>
              <ol className="tm-list tm-bench">
                {ir.map((r) => (
                  <Row key={r.spot.player_id} row={r} names={names} bench quiet />
                ))}
              </ol>
            </>
          )}
        </>
      </Slide>
    </section>
  )
}

/**
 * One team's full stat lines on a phone: the names stay pinned on the left and PTS on the right, the
 * columns between slide sideways, and ‹ › page them for anyone who doesn't swipe.
 */
function Slide({ side, children }: { side: Side; children: ReactNode }) {
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
  const playing = side.starters.filter((r) => r.state === 'live' && r.line).length
  const later = side.starters.filter((r) => r.state === 'later').length
  const done = side.starters.filter((r) => r.state === 'final').length
  const counts = [playing && `${playing} live`, later && `${later} to come`, done && `${done} final`].filter(Boolean)
  return (
    <>
      <div className="tm-slide-head">
        <span className="tm-slide-counts">{counts.join(' · ')}</span>
        {!(at.start && at.end) && (
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

function ColumnHead() {
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
        {r.state === 'dnp' ? (
          <span className="tm-tag">
            <span className="tm-wmid">Did not play</span>
            <span className="tm-nmid">DNP</span>
          </span>
        ) : (
          // On phones the grey mark says Final; the score always shows.
          <span className="tm-tag tm-wmid">Final</span>
        )}
        <span>{result(r, g)}</span>
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

function Row({
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
  const ember = r.game && live ? emberOf(r.game) : null
  // Live: filled while he's on the floor, hollow while he sits. Done for the night: grey.
  const mark: Mark | null = live
    ? l?.on_court === false
      ? 'sitting'
      : 'oncourt'
    : r.state === 'final' || r.state === 'dnp'
      ? 'done'
      : null
  const avg = r.spot.season_avg
  const card = !!l && l.minutes > 0
  const cls = [
    'tm-row',
    card ? 'tm-card' : '',
    live ? 'tm-livex sc-ember' : '',
    grade ? `tm-g-${grade.tier}` : '',
    bench ? 'tm-benchrow' : '',
    left ? 'tm-left' : '',
    quiet ? 'tm-quietrow' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const attrs = ember ? emberAttrs(ember) : {}
  const short = names.get(r.spot.name) ?? r.spot.name
  const player = { id: r.spot.player_id, name: r.spot.name }
  return (
    <li>
      <div
        className={cls}
        id={left ? `tm-p-${r.spot.player_id}` : undefined}
        tabIndex={left ? -1 : undefined}
        {...attrs}
      >
        {ember && <Burn />}
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
        ) : r.state === 'later' && avg && !quiet ? (
          <span className="tm-note">
            usually {Math.round(avg.pts)} PTS · {Math.round(avg.reb)} REB · {Math.round(avg.ast)} AST
          </span>
        ) : (
          <span className="tm-note" />
        )}
      </div>
    </li>
  )
}

type Mark = 'oncourt' | 'sitting' | 'done'
const MARK_WORD: Record<Mark, string> = {
  oncourt: 'On the floor now',
  sitting: 'On the bench now',
  done: 'Game over',
}

function Grade({ g }: { g: NightGrade }) {
  return (
    <span className={`tm-grade ${g.tier}`} aria-label={`grade ${g.grade}`}>
      {g.letter}
      {g.mod && <sup>{g.mod}</sup>}
    </span>
  )
}

function StatCells({ line: l }: { line: GameLine | Totals }) {
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

function Totals({ totals }: { totals: Totals }) {
  return (
    <div className="tm-tot">
      <span className="tm-tot-lab">Starters so far</span>
      <StatCells line={totals} />
    </div>
  )
}

function EmptyRow({ slot }: { slot: string }) {
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

/** The shape of the Today view while the day's games and both lineups load. */
export function TodayLoading() {
  return (
    <div className="tm tm-loading" aria-busy="true" aria-label="Loading today's matchup">
      <Bone h={64} className="tm-bone-score" />
      <div className="tm-tiles">
        {Array.from({ length: 9 }, (_, i) => (
          <Bone key={i} h={64} className="tm-bone-tile" />
        ))}
      </div>
      <div className="tm-cols">
        {[0, 1].map((c) => (
          <div key={c} className="tm-col">
            {Array.from({ length: 6 }, (_, i) => (
              <Bone key={i} h={52} className="tm-bone-row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
