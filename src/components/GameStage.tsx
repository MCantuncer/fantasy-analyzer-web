import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode, TouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { CaretDown, CaretLeft, CaretRight, Check, Clock, Prohibit, X } from '@phosphor-icons/react'
import { MIN_ODD, clock, gameCall, gotLine, lostWhy, marketPair, num, odds } from '../lib/iddaaCompare'
import type { CompareGame, GameCallView, Line, Stat } from '../lib/iddaaCompare'
import {
  PHASE_NAME,
  PICK_KINDS,
  bestEdge,
  chosenGame,
  duelReach,
  edgeTag,
  phaseOf,
  pos,
  readGameParam,
  useShownGame,
  scaleAround,
  slateGroups,
  writeGameParam,
} from '../lib/gameStage'
import type { Phase } from '../lib/gameStage'
import { isEdge, pickSide } from '../lib/quarterBets'
import { kuponKey } from '../lib/coupons'
import { useEscapeLayer } from '../lib/escapeStack'
import { useSwipeToClose } from '../lib/swipeToClose'
import { teamLight } from '../lib/nbaTeams'
import { TeamLogo } from './PlayerHead'
import { KuponTag } from './EstimateBits'
import { NumLine, Ring } from './GameLines'
import { QuarterBets } from './QuarterBets'
import './GameStage.css'

// Game picks one match at a time (Can 2026-11-24, concept B "Slate and Stage"): a slate of the
// night's matches (Final / Live / To come) and the chosen match on a stage. On phones the slate folds
// into a switcher that opens a bottom sheet. The card is drawn, not written: the score call is a duel
// bar, each bet a number line, our chance a ring.

type Of = (g: CompareGame, s: Stat) => Line | undefined

const by = (team: string, v: number) => (Math.abs(v) < 0.05 ? 'Level' : `${team} by ${num(Math.abs(v))}`)

/** A club logo on a disc, lit by the club's colour. */
function Disc({ team, size }: { team: string; size: number }) {
  return (
    <span
      className="ic-gs-disc"
      style={{ '--tc': teamLight(team) ?? 'transparent', '--s': `${size}px` } as CSSProperties}
    >
      <TeamLogo abbrev={team} size={size} fallback />
    </span>
  )
}

function Pair({ g, size }: { g: CompareGame; size: number }) {
  return (
    <span className="ic-gs-pr" aria-hidden="true">
      <Disc team={g.away} size={size} />
      <Disc team={g.home} size={size} />
    </span>
  )
}

/** The game's club colours, set only for a club we know (the CSS falls back to plain ink). */
function clubs(g: CompareGame): CSSProperties {
  const style: Record<string, string> = {}
  const a = teamLight(g.away)
  const h = teamLight(g.home)
  if (a) style['--ta'] = a
  if (h) style['--tb'] = h
  return style as CSSProperties
}

/** The game's bets (a book line above 1.33), and once settled how many won. */
function betsOf(g: CompareGame, of: Of) {
  const bets = PICK_KINDS.map(([s]) => of(g, s)).filter((l): l is Line => !!l?.barem)
  const settled = bets.filter((l) => l.oursHit != null)
  return { bets, settled, won: settled.filter((l) => l.oursHit).length }
}

/** Did our call name the winner? null before the result. */
function calledRight(g: CompareGame, call: GameCallView | null): boolean | null {
  if (!call || g.away_score == null || g.home_score == null || g.status !== 'final') return null
  return Math.sign(call.home - call.away) === Math.sign(g.home_score - g.away_score)
}

function Status({ g, phase }: { g: CompareGame; phase: Phase }) {
  if (phase === 'final')
    return (
      <span className="ic-gs-st">
        Final{' '}
        <span className="num">
          {g.away_score}–{g.home_score}
        </span>
      </span>
    )
  if (phase === 'live')
    return (
      <span className="ic-gs-st live">
        <span className="ic-live" aria-hidden="true" />
        Live
      </span>
    )
  return (
    <span className="ic-gs-st">
      <Clock size={13} aria-hidden="true" />
      Tip <span className="num">{clock(g.tip)}</span>
    </span>
  )
}

/** One slate row: logos, the teams, tip / Live / final score; then our pick and chance, the bets and
 *  a value tag before; after, a pip per bet, the tally and whether we named the winner. */
function SlateRow({
  g,
  lines,
  of,
  phase,
  on,
  onPick,
}: {
  g: CompareGame
  lines: Line[]
  of: Of
  phase: Phase
  on: boolean
  onPick: (id: number) => void
}) {
  const call = gameCall(g, lines)
  const { bets, settled, won } = betsOf(g, of)
  const edge = bestEdge(g.quarters)
  const quarterEdges = (g.quarters ?? []).filter((b) => isEdge(b) && pickSide(b)).length
  const n = bets.length + quarterEdges
  const right = calledRight(g, call)
  return (
    <button
      type="button"
      className={`ic-gs-row${phase === 'final' ? ' post' : ''}`}
      aria-current={on ? 'true' : undefined}
      data-game={g.game_id}
      style={clubs(g)}
      onClick={() => onPick(g.game_id)}
    >
      <Pair g={g} size={26} />
      <span className="ic-gs-mid">
        <b>{`${g.away} @ ${g.home}`}</b>
        <Status g={g} phase={phase} />
      </span>
      <span className="ic-gs-end">
        {phase === 'final' ? (
          <>
            {settled.length > 0 && (
              <span className="ic-gs-wl">
                <span className="pips" aria-hidden="true">
                  {settled.map((l) => (
                    <i key={l.id} className={l.oursHit ? 'w' : 'l'} />
                  ))}
                </span>
                <span className="num">
                  {won}–{settled.length - won}
                </span>
                <span className="sr-only"> bets won</span>
              </span>
            )}
            {call && right != null && (
              <span className="ic-gs-meta">
                {call.pick} called {right ? 'right' : 'wrong'}
              </span>
            )}
          </>
        ) : (
          <>
            {call?.chance != null && (
              <span className="ic-gs-pick">
                {call.pick} <span className="num">{Math.round(call.chance * 100)}%</span>
                <Ring value={call.chance} mini />
              </span>
            )}
            <span className="ic-gs-meta">
              {n > 0 ? (
                <>
                  <span className="num">{n}</span> {n === 1 ? 'bet' : 'bets'}
                </>
              ) : (
                'No bet'
              )}
              {edge != null && (
                <span className="ic-gs-edge num" title="Best quarter bet value">
                  {edgeTag(edge)}
                </span>
              )}
            </span>
          </>
        )}
      </span>
    </button>
  )
}

/** The slate's rows grouped Final / Live / To come. ↑ ↓ move through it. */
function SlateList({
  groups,
  lines,
  of,
  chosen,
  onPick,
  now,
}: {
  groups: { phase: Phase; games: CompareGame[] }[]
  lines: Line[]
  of: Of
  chosen: number | null
  onPick: (id: number) => void
  now: Date
}) {
  const order = groups.flatMap((s) => s.games)
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const i = order.findIndex((g) => g.game_id === chosen)
    const j = Math.min(order.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))
    if (j === i) return
    e.preventDefault()
    const id = order[j].game_id
    onPick(id)
    e.currentTarget.querySelector<HTMLElement>(`[data-game="${id}"]`)?.focus()
  }
  return (
    <div className="ic-gs-list" onKeyDown={onKey}>
      {groups.map((s) => (
        <div key={s.phase} className="ic-gs-grp" role="group" aria-label={PHASE_NAME[s.phase]}>
          <span className="ic-gs-gh" aria-hidden="true">
            {PHASE_NAME[s.phase]} <span className="num">{s.games.length}</span>
          </span>
          {s.games.map((g) => (
            <SlateRow
              key={g.game_id}
              g={g}
              lines={lines}
              of={of}
              phase={phaseOf(g, now)}
              on={g.game_id === chosen}
              onPick={onPick}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** The score call as a duel: one bar pulled from even toward the leader, in his club colour, with
 *  the book's handicap as a tick. After the game the bar is the real margin, a dashed marker our call. */
function Duel({ g, call, mar, phase }: { g: CompareGame; call: GameCallView; mar: Line | undefined; phase: Phase }) {
  const final = phase === 'final'
  const r = (v: number) => Math.round(v)
  // whole numbers; one decimal when rounding would tie or flip our pick
  const shows = (v: number, other: number) => (r(v) === r(other) ? v.toFixed(1) : String(r(v)))
  const ours = call.home - call.away
  const real = final ? (g.home_score ?? 0) - (g.away_score ?? 0) : null
  const book = mar?.book != null ? (mar.team === g.home ? mar.book : -mar.book) : null
  const shown = real ?? ours
  const reach = duelReach(ours, real, book)
  const p = (v: number) => pos(v, -reach, reach)
  const lead = shown >= 0 ? g.home : g.away
  const tc = teamLight(lead) ?? 'var(--text-2)'
  const awayScore = final ? String(g.away_score) : shows(call.away, call.home)
  const homeScore = final ? String(g.home_score) : shows(call.home, call.away)
  const awayLoses = shown > 0
  const right = calledRight(g, call)
  const say = final
    ? `Final: ${g.away} ${g.away_score}, ${g.home} ${g.home_score}. Our call was ${shows(call.away, call.home)} to ${shows(call.home, call.away)}.`
    : `Our score: ${g.away} ${shows(call.away, call.home)}, ${g.home} ${shows(call.home, call.away)}.${
        call.chance != null ? ` We give ${call.pick} a ${Math.round(call.chance * 100)}% chance to win.` : ''
      }`
  return (
    <div className="ic-gs-duel">
      <span className="sr-only">{say}</span>
      <span className={`ic-gs-side${awayLoses ? ' lose' : ''}`} aria-hidden="true">
        <small>
          <i style={{ '--tc': teamLight(g.away) ?? 'var(--muted)' } as CSSProperties} />
          {g.away}
        </small>
        <b className="num">{awayScore}</b>
        {final && <span className="call">ours {shows(call.away, call.home)}</span>}
      </span>
      <span className="ic-gs-mbar" aria-hidden="true">
        <span className="ic-gs-mlab">
          <span>{final ? 'Final' : 'Our score'}</span>
          <span>
            <b>{by(lead, shown)}</b>
            <span className="x">
              {' '}
              · Total <span className="num">{final ? (g.away_score ?? 0) + (g.home_score ?? 0) : r(call.total)}</span>
            </span>
          </span>
        </span>
        <span className="ic-gs-track" style={{ '--tc': tc } as CSSProperties}>
          <i className="mid" />
          <i className="fill" style={{ left: `${Math.min(50, p(shown))}%`, width: `${Math.abs(p(shown) - 50)}%` }} />
          {book != null && <i className="bk" style={{ left: `${p(book)}%` }} />}
          {final && <i className="ghost" style={{ left: `${p(ours)}%` }} />}
        </span>
        <span className="ic-gs-scale">
          <span>{`${g.away} by ${reach}`}</span>
          <span>even</span>
          <span>{`${g.home} by ${reach}`}</span>
        </span>
        <span className="ic-gs-mfoot">
          {final ? (
            <span>
              <i className="lgg" />
              Our call <b className="num">{by(ours >= 0 ? g.home : g.away, r(ours))}</b>
            </span>
          ) : (
            call.chance != null && (
              <span>
                Win chance <b>{call.pick}</b> <b className="num">{Math.round(call.chance * 100)}%</b>
              </span>
            )
          )}
          {book != null && (
            <span>
              <i className="lgb" />
              Book <b className="num">{by(book >= 0 ? g.home : g.away, book)}</b>
            </span>
          )}
          {right != null && (
            <span className={right ? 'ok' : 'no'}>
              {right ? <Check size={12} weight="bold" /> : <X size={12} weight="bold" />}
              {right ? 'Right winner' : 'Wrong winner'}
            </span>
          )}
        </span>
      </span>
      <span className={`ic-gs-side h${!awayLoses && shown !== 0 ? ' lose' : ''}`} aria-hidden="true">
        <small>
          {g.home}
          <i style={{ '--tc': teamLight(g.home) ?? 'var(--muted)' } as CSSProperties} />
        </small>
        <b className="num">{homeScore}</b>
        {final && <span className="call">ours {shows(call.home, call.away)}</span>}
      </span>
    </div>
  )
}

const word = (prefix: string, text: string | null) =>
  text == null ? null : (
    <>
      {prefix} <b className="num">{text}</b>
    </>
  )

/** A game line on its number line: the handicap on the home side's margin (home to the right, like
 *  the duel), the total on points, the match result on the chance. */
function lineOf(l: Line, g: CompareGame) {
  const { book, ours } = marketPair(l)
  const got = gotLine(l)
  const done = l.game.status === 'final' && l.oursHit != null
  const gotMark = (at: number | null) =>
    done && at != null && got ? { at, ok: !!l.oursHit, label: word('Got', got.replace(/^Got /, '')) } : null
  if (l.stat === 'WIN') {
    if (l.ours == null) return null
    return {
      lo: 0,
      hi: 1,
      book: l.book != null ? { at: l.book, label: word('Book', `${Math.round(l.book * 100)}%`) } : null,
      ours: { at: l.ours, label: word('Ours', `${Math.round(l.ours * 100)}%`) },
      got: null,
      win: { from: 0, to: l.ours },
      tc: teamLight(l.team) ?? null,
    }
  }
  if (l.ours == null) return null
  const home = l.stat === 'MAR' ? (v: number) => (l.team === g.home ? v : -v) : (v: number) => v
  const mid = home(l.book ?? l.ours)
  const { lo, hi } = scaleAround(
    mid,
    [home(l.ours), l.actual != null ? home(l.actual) : null],
    l.stat === 'MAR' ? 6 : 8,
  )
  // the side the bet wins on: Over (or the pick covering) is above the line, in home terms for a handicap
  const up = l.barem?.side === 'over'
  const right = l.stat === 'MAR' ? up === (l.team === g.home) : up
  return {
    lo,
    hi,
    book: l.book != null ? { at: mid, label: word('Book', book) } : null,
    ours: { at: home(l.ours), label: word('Ours', ours) },
    got: gotMark(l.actual != null ? home(l.actual) : null),
    win: l.barem && l.book != null ? (right ? { from: mid, to: hi } : { from: mid, to: lo }) : null,
    tc: null,
  }
}

/** One market as a lane: the bet, its number line, the odds, our chance as a ring (or Won / Lost). */
function BetLane({ l, kind, kupons, g }: { l: Line; kind: string; kupons: string[]; g: CompareGame }) {
  const b = l.barem
  const pair = marketPair(l)
  const geo = lineOf(l, g)
  const say = [pair.book && `Book ${pair.book}`, pair.ours && `Ours ${pair.ours}`, gotLine(l)]
    .filter(Boolean)
    .join(' · ')
  const drawn = geo && <NumLine {...geo} />
  if (!b) {
    const why =
      l.ours == null
        ? 'No line yet'
        : l.stat === 'WIN' && l.team
          ? `${l.team} odds ${MIN_ODD.toFixed(2)} or less`
          : `Odds ${MIN_ODD.toFixed(2)} or less`
    return (
      <li className="ic-gs-lane none">
        <span className="ic-gs-bet">
          <span className="ml">{kind}</span>
          {l.stat === 'WIN' && l.team && <b className="bt">{`${l.team} to win`}</b>}
        </span>
        {drawn ?? <span />}
        <span className="nb">
          <Prohibit size={14} aria-hidden="true" />
          <span>
            <b>No bet</b>
            <i className="dot" aria-hidden="true">
              ·
            </i>
            <span>{why}</span>
          </span>
        </span>
        {say && <span className="sr-only">{say}</span>}
      </li>
    )
  }
  const done = l.game.status === 'final' && l.oursHit != null
  const why = lostWhy(l)
  return (
    <li className={`ic-gs-lane${done ? (l.oursHit ? ' won' : ' lost') : ''}`}>
      <span className="ic-gs-bet">
        <span className="ml">{kind}</span>
        <span className="bt">
          <b className={l.stat === 'WIN' ? '' : 'num'}>{b.label}</b>
          <KuponTag kupons={kupons} />
        </span>
      </span>
      {drawn ?? <span />}
      {say && <span className="sr-only">{say}</span>}
      <span className="ic-gs-od">
        <b className="num">{b.odd != null ? odds(b.odd) : '–'}</b>
        <span>odds</span>
      </span>
      {done ? (
        <span className={`ic-gs-rs ${l.oursHit ? 'ok' : 'no'}`}>
          {l.oursHit ? (
            <Check size={13} weight="bold" aria-hidden="true" />
          ) : (
            <X size={13} weight="bold" aria-hidden="true" />
          )}
          {l.oursHit ? 'Won' : 'Lost'}
        </span>
      ) : b.sure != null ? (
        <Ring value={b.sure} />
      ) : (
        <span />
      )}
      {why && <span className="why">{why}</span>}
    </li>
  )
}

/** The chosen match: its head with Game N of M and ‹ ›, the duel, the bets as lanes, the quarter
 *  bets, and the way to the player estimates. */
function Stage({
  g,
  lines,
  of,
  kupons,
  phase,
  at,
  count,
  onStep,
  onCard,
}: {
  g: CompareGame
  lines: Line[]
  of: Of
  kupons: Map<string, string[]>
  phase: Phase
  at: number
  count: number
  onStep: (d: number) => void
  onCard: (game: number) => void
}) {
  const call = gameCall(g, lines)
  const { bets, settled, won } = betsOf(g, of)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    touch.current = t ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current
    const t = e.changedTouches[0]
    touch.current = null
    if (!s || !t) return
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // a clear sideways swipe only, so scrolling down the card never changes the match
    if (Math.abs(dx) > 64 && Math.abs(dx) > 2 * Math.abs(dy)) onStep(dx < 0 ? 1 : -1)
  }
  const sub =
    phase === 'final'
      ? settled.length > 0
        ? `bets won ${won}–${settled.length - won}`
        : null
      : phase === 'next' && bets.length > 0
        ? `${bets.length} ${bets.length === 1 ? 'bet' : 'bets'}`
        : null
  return (
    <article
      className={`ic-gs-card${phase === 'final' ? ' post' : ''}`}
      style={clubs(g)}
      aria-label={`${g.away} at ${g.home}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="ic-gs-sh">
        <Pair g={g} size={40} />
        <span className="ic-gs-gn">
          <b>{`${g.away} @ ${g.home}`}</b>
          <span className={phase === 'live' ? 'live' : ''}>
            {phase === 'final' ? (
              'Final'
            ) : phase === 'live' ? (
              <>
                <span className="ic-live" aria-hidden="true" />
                Live
              </>
            ) : (
              <>
                <Clock size={14} aria-hidden="true" />
                Tip <span className="num">{clock(g.tip)}</span>
              </>
            )}
            {sub && <span className="ic-gs-gsub"> · {sub}</span>}
          </span>
        </span>
        <span className="ic-gs-nav">
          <span className="ic-gs-pos">
            Game <b className="num">{at + 1}</b> of <b className="num">{count}</b>
          </span>
          <button
            type="button"
            className="ic-gs-arw"
            aria-label="Previous match"
            disabled={at === 0}
            onClick={() => onStep(-1)}
          >
            <CaretLeft size={18} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ic-gs-arw"
            aria-label="Next match"
            disabled={at === count - 1}
            onClick={() => onStep(1)}
          >
            <CaretRight size={18} weight="bold" aria-hidden="true" />
          </button>
        </span>
      </header>
      {call && <Duel g={g} call={call} mar={of(g, 'MAR')} phase={phase} />}
      <ul className="ic-gs-lanes" aria-label={`${g.away} @ ${g.home} bets`}>
        {PICK_KINDS.map(([s, kind]) => {
          const l = of(g, s)
          return l ? <BetLane key={kind} l={l} kind={kind} g={g} kupons={kupons.get(kuponKey(l)) ?? []} /> : null
        })}
      </ul>
      <QuarterBets g={g} />
      {(g.estimates?.length ?? 0) > 0 && (
        <button
          type="button"
          className="ic-gs-more"
          aria-haspopup="dialog"
          aria-label={`${g.away} at ${g.home}: player estimates`}
          onClick={() => onCard(g.game_id)}
        >
          Player estimates
          <CaretRight size={14} weight="bold" aria-hidden="true" />
        </button>
      )}
    </article>
  )
}

/** Phones: the slate as a bottom sheet, opened from the switcher. Esc, the scrim or ✕ closes it. */
function Sheet({ onClose, children, title }: { onClose: () => void; children: ReactNode; title: string }) {
  const close = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  useEscapeLayer(true, onClose)
  useSwipeToClose(sheet, onClose, { media: '(max-width: 719px)', backdrop: scrim })
  useEffect(() => {
    close.current?.focus()
    const body = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = body
    }
  }, [])
  // the sheet is for phones: widening the window to the slate closes it
  const shut = useRef(onClose)
  useEffect(() => {
    shut.current = onClose
  })
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 720px)')
    if (!mq) return
    const on = () => mq.matches && shut.current()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return createPortal(
    <>
      <div ref={scrim} className="ic-gs-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={sheet} className="ic-gs-sheet" role="dialog" aria-modal="true" aria-labelledby="ic-gs-sheet-h">
        <i className="grab" aria-hidden="true" />
        <div className="hd">
          <h4 id="ic-gs-sheet-h">
            Tonight's matches <span className="num">{title}</span>
          </h4>
          <button ref={close} type="button" className="x" aria-label="Close" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="ls">{children}</div>
      </div>
    </>,
    document.body,
  )
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || !!t.closest('input, textarea, select, [role="slider"], [role="tablist"], [role="listbox"]'))

/** The slate and the stage. The chosen match lives in `?game=`; ← → (and K J) move between matches
 *  anywhere on the page unless a field, a widget of its own or a dialog has the keys. */
export function GameSlate({
  games,
  lines,
  of,
  kupons,
  onCard,
}: {
  games: CompareGame[]
  lines: Line[]
  of: Of
  kupons: Map<string, string[]>
  onCard: (game: number) => void
}) {
  // the phases are read once a minute, so a match moves from To come to Live without a reload
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const groups = useMemo(() => slateGroups(games, now), [games, now])
  const order = useMemo(() => groups.flatMap((s) => s.games), [groups])
  const [asked, setAsked] = useState<number | null>(readGameParam)
  const chosen = chosenGame(order, asked, now)
  const at = Math.max(
    0,
    order.findIndex((g) => g.game_id === chosen),
  )
  const g = order[at]
  const [sheet, setSheet] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const switcher = useRef<HTMLButtonElement>(null)

  const pick = (id: number, scroll = true) => {
    setAsked(id)
    writeGameParam(id)
    // bring the card's top into view when it has scrolled away (the slate stays in reach, sticky)
    const el = root.current
    if (scroll && el && el.getBoundingClientRect().top < 0) {
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView?.({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
    }
  }
  const step = (d: number) => {
    const next = order[at + d]
    if (next) pick(next.game_id)
  }
  // the Night File's "Show in Game picks": take the match it asks for (the page scrolls there itself)
  const shownGame = useShownGame()
  useEffect(() => {
    if (!shownGame) return
    setAsked(shownGame.id)
    writeGameParam(shownGame.id)
  }, [shownGame])
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  })
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (typing(e.target) || document.querySelector('[aria-modal="true"]')) return
      const k = e.key
      const d = k === 'ArrowRight' || k === 'j' || k === 'J' ? 1 : k === 'ArrowLeft' || k === 'k' || k === 'K' ? -1 : 0
      if (!d) return
      e.preventDefault()
      stepRef.current(d)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  if (!g) return null
  const phase = phaseOf(g, now)
  const list = (
    <SlateList
      groups={groups}
      lines={lines}
      of={of}
      chosen={chosen}
      now={now}
      onPick={(id) => {
        pick(id, !sheet)
        if (sheet) {
          setSheet(false)
          switcher.current?.focus()
        }
      }}
    />
  )
  return (
    <div className="ic-gs" ref={root}>
      <nav className="ic-gs-slate" aria-label="Tonight's matches">
        {list}
        <p className="ic-gs-keys" aria-hidden="true">
          <kbd>←</kbd>
          <kbd>→</kbd> or <kbd>K</kbd>
          <kbd>J</kbd> to move
        </p>
      </nav>
      <div className="ic-gs-stage">
        <div className="ic-gs-sw">
          <button
            type="button"
            className="ic-gs-arw"
            aria-label="Previous match"
            disabled={at === 0}
            onClick={() => step(-1)}
          >
            <CaretLeft size={18} weight="bold" aria-hidden="true" />
          </button>
          <button
            ref={switcher}
            type="button"
            className="ic-gs-swb"
            style={clubs(g)}
            aria-haspopup="dialog"
            aria-expanded={sheet}
            onClick={() => setSheet(true)}
          >
            <Pair g={g} size={26} />
            <b>{`${g.away} @ ${g.home}`}</b>
            <span className="of">
              <span className="num">{at + 1}</span> of <span className="num">{order.length}</span>
            </span>
            <CaretDown className="cv" size={16} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ic-gs-arw"
            aria-label="Next match"
            disabled={at === order.length - 1}
            onClick={() => step(1)}
          >
            <CaretRight size={18} weight="bold" aria-hidden="true" />
          </button>
          <span className="ic-gs-dots" aria-hidden="true">
            {order.map((x, i) => (
              <i key={x.game_id} className={`${i === at ? 'on' : ''}${phaseOf(x, now) === 'live' ? ' lv' : ''}`} />
            ))}
          </span>
        </div>
        <Stage
          key={g.game_id}
          g={g}
          lines={lines}
          of={of}
          kupons={kupons}
          phase={phase}
          at={at}
          count={order.length}
          onStep={step}
          onCard={onCard}
        />
      </div>
      {sheet && (
        <Sheet title={`${order.length}`} onClose={() => setSheet(false)}>
          {list}
        </Sheet>
      )}
    </div>
  )
}
