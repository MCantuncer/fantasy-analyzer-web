import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { CaretDown, Check, Ticket, X } from '@phosphor-icons/react'
import { odds } from '../lib/iddaaCompare'
import type { CompareGame, QuarterBet, QuarterRecord } from '../lib/iddaaCompare'
import {
  gotText,
  isEdge,
  needs,
  oursText,
  pickSide,
  quarterCount,
  quarterGrid,
  quarterLabel,
  sideLabel,
  valueText,
} from '../lib/quarterBets'
import { unitsSigned } from '../lib/ourRecord'
import { teamLight } from '../lib/nbaTeams'
import { scaleAround } from '../lib/gameStage'
import { NumLine, Ring } from './GameLines'
import './QuarterBets.css'

type Teams = Pick<CompareGame, 'away' | 'home'>

const QS = ['1st', '2nd', '3rd', '4th']

const one = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
const word = (prefix: string, text: string) => (
  <>
    {prefix} <b className="num">{text}</b>
  </>
)

/** A quarter bet on its number line: totals on points (the book's line a tick), winners and the
 *  first half's handicap on the home side's margin (home to the right, like the duel). The side we
 *  lean to is shaded; once played the result is a diamond. */
function lineOf(b: QuarterBet, g: Teams) {
  const margin = b.market === 'q_winner' || b.market === 'h1_margin'
  const mid = b.market === 'q_winner' ? 0 : b.market === 'h1_margin' ? -(b.line ?? 0) : (b.line ?? b.ours)
  const { lo, hi } = scaleAround(mid, [b.ours, b.actual], margin ? 4 : 5)
  const up = b.pick === 'over' || b.pick === 'home'
  const got = gotText(b, g)
  return {
    lo,
    hi,
    book: {
      at: mid,
      label:
        b.market === 'q_winner'
          ? 'Even'
          : word('Book', b.market === 'h1_margin' ? sideLabel(b, 'home', g) : String(b.line ?? '')),
    },
    ours: { at: b.ours, label: word('Ours', margin ? oursText(b, g) : one(b.ours)) },
    got:
      b.actual != null && b.hit != null && got
        ? { at: b.actual, ok: b.hit, label: word('Got', got.replace(/^Got /, '')) }
        : null,
    win: b.pick ? (up ? { from: mid, to: hi } : { from: mid, to: lo }) : null,
    tc: margin && b.pick ? (teamLight(b.pick === 'home' ? g.home : g.away) ?? null) : null,
  }
}

/** One edge slip as a lane: when and the bet with its value, its number line, the odds, our chance
 *  as a ring with a notch at what the price needs; after the game Won / Lost. */
function EdgeSlip({ b, g }: { b: QuarterBet; g: Teams }) {
  const s = pickSide(b)
  if (!s) return null
  const { when, what } = quarterLabel(b, g)
  const done = b.hit != null
  const got = gotText(b, g)
  const book =
    b.line != null
      ? b.market === 'h1_margin'
        ? sideLabel(b, 'home', g)
        : String(b.line)
      : `${Math.round(s.book * 100)}%`
  const need = needs(s.odd)
  return (
    <li className={`ic-gs-lane ic-gq-slip${done ? (b.hit ? ' won' : ' lost') : ''}`}>
      <span className="ic-gs-bet">
        <span className="ml">
          {when} {what}
        </span>
        <span className="bt">
          <b className="num">{sideLabel(b, s.side, g)}</b>
          <span className="ic-gq-val">
            Value <b className="num">{valueText(s.value)}</b>
          </span>
        </span>
      </span>
      <NumLine {...lineOf(b, g)} />
      <span className="sr-only">{`${done && got ? got : `Book ${book}`} · Ours ${oursText(b, g)}`}</span>
      <span className="ic-gs-od">
        <b className="num">{odds(s.odd)}</b>
        <span>odds</span>
      </span>
      {done ? (
        <span className={`ic-gs-rs ${b.hit ? 'ok' : 'no'}`}>
          {b.hit ? (
            <Check size={13} weight="bold" aria-hidden="true" />
          ) : (
            <X size={13} weight="bold" aria-hidden="true" />
          )}
          {b.hit ? 'Won' : 'Lost'}
        </span>
      ) : (
        <span className="ic-gq-rn">
          <Ring value={s.ours} need={need} />
          <span className="ic-gq-need">
            needs <span className="num">{Math.round(need * 100)}%</span>
          </span>
        </span>
      )}
    </li>
  )
}

/** A cell of the grid: the bet we lean to, our number in outline, its mini number line, our chance
 *  against what the price needs, its odds and value; after the game what happened and ✓ / ✗. A hole
 *  where the book has no line; "No bet" at 1.33 or under. `ph` names the quarter on phones (2 across). */
function Cell({ b, g, head, ph }: { b: QuarterBet | null; g: Teams; head?: string; ph?: string }) {
  if (!b) {
    return (
      <div className="ic-gq-cell none">
        {head && <span className="ic-gq-head">{head}</span>}
        {ph && <span className="ic-gq-head ic-gq-ph">{ph}</span>}
        <span className="ic-gq-hole">No line</span>
      </div>
    )
  }
  const s = pickSide(b)
  const got = gotText(b, g)
  const edge = isEdge(b)
  const margin = b.market === 'q_winner' || b.market === 'h1_margin'
  const lean = margin ? (b.ours >= 0 ? g.home : g.away) : null
  const tc = lean ? teamLight(lean) : undefined
  const label = s
    ? sideLabel(b, s.side, g)
    : margin
      ? b.ours >= 0
        ? g.home
        : g.away
      : sideLabel(b, b.ours >= (b.line ?? 0) ? 'over' : 'under', g)
  const need = s ? Math.round(needs(s.odd) * 100) : null
  return (
    <div
      className={`ic-gq-cell${edge ? ' edge' : ''}${b.hit === true ? ' won' : b.hit === false ? ' lost' : ''}`}
      style={tc ? ({ '--tc': tc } as CSSProperties) : undefined}
    >
      {head && <span className="ic-gq-head">{head}</span>}
      {ph && <span className="ic-gq-head ic-gq-ph">{ph}</span>}
      <span className="ic-gq-bet">
        <b className="num">{label}</b>
        {b.hit === true && <Check className="ok" size={12} weight="bold" aria-label="Won" />}
        {b.hit === false && <X className="no" size={12} weight="bold" aria-label="Lost" />}
      </span>
      <span className="ic-gq-ours">
        {margin && <small>by </small>}
        <b>{margin ? Math.abs(b.ours).toFixed(1) : b.ours.toFixed(1)}</b>
      </span>
      <NumLine {...lineOf(b, g)} small />
      {got && <span className="ic-gq-got">{got}</span>}
      {s && need != null ? (
        <>
          <span className="ic-gq-chb">
            <i className="bar" aria-hidden="true">
              <i style={{ width: `${Math.round(Math.min(1, Math.max(0, s.ours)) * 100)}%` }} />
              <em style={{ left: `${Math.min(100, need)}%` }} />
            </i>
            <span className="num">{Math.round(s.ours * 100)}%</span>
            <span className="sr-only">{`, needs ${need}%`}</span>
          </span>
          <span className="ic-gq-foot">
            <span className="num">{odds(s.odd)}</span>
            <span className={`ic-gq-v num${edge ? ' on' : ''}`}>{valueText(s.value)}</span>
          </span>
        </>
      ) : (
        <span className="ic-gq-foot">
          <span className="ic-gq-nobet">No bet · odds 1.33 or less</span>
        </span>
      )}
    </div>
  )
}

/** Under a game's rows: the quarter and first-half bets with value as slips, then every quarter bet
 *  in a fold (a grid: winner and total by quarter, the first half's handicap, total and team points).
 *  Watch only: none of these are on Kupons until they beat the price. */
export function QuarterBets({ g }: { g: CompareGame }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const bets = g.quarters ?? []
  if (!bets.length) return null
  const c = quarterCount(bets)
  const edges = bets.filter((b) => isEdge(b) && pickSide(b))
  const grid = quarterGrid(bets)
  const halfHeads = ['Handicap', 'Total', `${g.away} points`, `${g.home} points`]
  return (
    <div className="ic-gq">
      <div className="ic-gq-top">
        <h3>
          {edges.length ? (
            <>
              Quarter bets with value <span className="num">· {edges.length}</span>
            </>
          ) : (
            'Quarter bets'
          )}
        </h3>
        <span className="ic-gq-watch">
          {edges.length ? (
            <>
              <Ticket size={14} aria-hidden="true" />
              Watch only, not in Kupons yet
            </>
          ) : (
            'No quarter bet with value in this game'
          )}
        </span>
      </div>
      {edges.length > 0 && (
        <ul className="ic-gs-lanes ic-gq-slips" aria-label={`${g.away} @ ${g.home} quarter bets with value`}>
          {edges.map((b) => (
            <EdgeSlip key={`${b.market}-${b.period}`} b={b} g={g} />
          ))}
        </ul>
      )}
      <button
        type="button"
        className="ic-gq-fold"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <b>All quarter bets</b>{' '}
          <span className="ic-gq-count">
            {c.settled > 0 ? (
              <>
                <span className="num">{c.won}</span> of <span className="num">{c.settled}</span> right
              </>
            ) : (
              <>
                <span className="num">{c.bets}</span> {c.bets === 1 ? 'bet' : 'bets'}
              </>
            )}{' '}
            · {c.edges ? <span className="num">{c.edges}</span> : 'none'} with value
          </span>
        </span>
        <CaretDown size={16} weight="bold" aria-hidden="true" className={open ? 'up' : ''} />
      </button>
      {open && (
        <div className="ic-gq-grid" id={id}>
          <div className="ic-gq-cols" aria-hidden="true">
            <span />
            <span>1st</span>
            <span>2nd</span>
            <span>3rd</span>
            <span>4th</span>
          </div>
          <div className="ic-gq-line">
            <span className="ic-gq-rh">
              Winner <small>our side</small>
            </span>
            {grid.winner.map((b, i) => (
              <Cell key={`w${i}`} b={b} g={g} ph={QS[i]} />
            ))}
          </div>
          <div className="ic-gq-line">
            <span className="ic-gq-rh">
              Total <small>both teams</small>
            </span>
            {grid.total.map((b, i) => (
              <Cell key={`t${i}`} b={b} g={g} ph={QS[i]} />
            ))}
          </div>
          {grid.half.some(Boolean) && (
            <div className="ic-gq-line half">
              <span className="ic-gq-rh">1st half</span>
              {grid.half.map((b, i) => (
                <Cell key={`h${i}`} b={b} g={g} head={halfHeads[i]} />
              ))}
            </div>
          )}
          <p className="ic-gq-key">
            <span className="ic-gq-lg">
              <i className="lg-bk" aria-hidden="true" /> Book
            </span>
            <span className="ic-gq-lg">
              <i className="lg-ou" aria-hidden="true" /> Ours
            </span>
            <span className="ic-gq-lg">
              <i className="lg-got" aria-hidden="true" /> Result
            </span>
            <span className="ic-gq-lg">
              <i className="lg-need" aria-hidden="true" /> What the price needs
            </span>
            <span className="ic-gq-lg">
              <span className="ic-gq-v on num">+0.06</span> Value: our chance × odds − 1. Above 0 is an edge. The book
              keeps 15–25% on these, so most show a minus.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

/** The running quarter record in the Game picks head: every settled pick and the ones with value. */
export function QuarterRecordStrip({ rec }: { rec: QuarterRecord | null | undefined }) {
  if (!rec || rec.all.bets === 0) return null
  const part = (label: string, s: QuarterRecord['all']) => (
    <span className="ic-gq-rp">
      {label} <b className="num">{s.bets}</b>: won <b className="num">{s.won}</b>,{' '}
      <b className="num">{unitsSigned(s.returned)}</b>
    </span>
  )
  return (
    <div className="ic-gq-rec" aria-label="Quarter bets record">
      <b className="ic-gq-rt">Quarter record</b>
      {part('All', rec.all)}
      {part('With value', rec.edge)}
      <span className="ic-gq-rk">
        <Ticket size={14} aria-hidden="true" />
        Not in Kupons yet
      </span>
    </div>
  )
}
