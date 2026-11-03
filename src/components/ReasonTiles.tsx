import type { ReactNode } from 'react'
import type { TradeIdea } from '../api/client'
import { ordinal } from '../lib/format'
import { shortValue, type RoundValues } from '../lib/tradeValue'
import './ReasonTiles.css'

type Fact = NonNullable<TradeIdea['facts']>[number]

// Sentences that explain the numbers rather than make a point: they stay as a line under the tiles.
const NOTE_KINDS = new Set<Fact['kind']>(['vs_pickup', 'faab'])

interface Props {
  facts?: Fact[] | null
  /** The same points as sentences, for ideas saved before facts existed. */
  reasons: string[]
  title: string
  valueGet: number
  valueGive: number
  myCats: number
  theirCats: number
  rounds: RoundValues
}

/** "Why they might say yes" as one small tile per point, numbers drawn instead of written. */
export function ReasonTiles({ facts, reasons, title, valueGet, valueGive, myCats, theirCats, rounds }: Props) {
  const list = facts ?? []
  const tiles = list.filter((f) => !NOTE_KINDS.has(f.kind))
  const notes = list.filter((f) => NOTE_KINDS.has(f.kind))
  return (
    <div className="rt">
      <div className="detail-label">{title}</div>
      {!facts && reasons.length > 0 && (
        <ul className="reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <ul className="rt-grid">
        {tiles.map((f) => (
          <FactTile key={`${f.kind}-${f.player_id ?? ''}-${f.text}`} fact={f} rounds={rounds} />
        ))}
        <Tile icon="arrow" title="Value on paper" sr={`They get ${shortValue(valueGet, rounds)} for ${shortValue(valueGive, rounds)}`}>
          <Pair
            rows={[
              ['They get', valueGet, shortValue(valueGet, rounds), valueGet >= valueGive],
              ['They give', valueGive, shortValue(valueGive, rounds), valueGive > valueGet],
            ]}
          />
        </Tile>
        <Tile
          icon="plus"
          title="Categories a week"
          sr={`You ${signed(myCats)}, they ${signed(theirCats)} categories a week`}
        >
          <Diverging rows={[['You', myCats], ['They', theirCats]]} />
        </Tile>
      </ul>
      {notes.map((f) => (
        <p key={f.text} className="small muted rt-note">
          {f.text}
        </p>
      ))}
    </div>
  )
}

function FactTile({ fact: f, rounds }: { fact: Fact; rounds: RoundValues }) {
  const cats = f.categories ?? []
  switch (f.kind) {
    case 'sell_high':
    case 'buy_low': {
      const owners = f.owners_value ?? 0
      const ours = f.our_value ?? 0
      const label = (x: number, given?: string | null) => (rounds ? shortValue(x, rounds) : given || shortValue(x, rounds))
      return (
        <Tile icon={f.kind === 'sell_high' ? 'up' : 'down'} title={f.kind === 'sell_high' ? 'Sell high' : 'Buy low'} sub={f.player_name} sr={f.text}>
          <Pair
            rows={[
              ['Owners', owners, label(owners, f.owners_label), f.kind === 'sell_high'],
              ['Worth', ours, label(ours, f.our_label), f.kind === 'buy_low'],
            ]}
          />
        </Tile>
      )
    }
    case 'chasing':
      return (
        <Tile icon="bars" title="Chasing a spot" sr={f.text}>
          {f.rank && f.teams && f.playoff_spots ? (
            <>
              <Standing rank={f.rank} teams={f.teams} spots={f.playoff_spots} />
              <div className="small muted">
                <span className="num rt-big-inline">{ordinal(f.rank)}</span> of {f.teams}, top {f.playoff_spots} make it
              </div>
            </>
          ) : (
            <div className="small muted">Outside the playoff spots</div>
          )}
        </Tile>
      )
    case 'punt_cost':
      return (
        <Tile icon="check" title="Costs only punts" sr={f.text}>
          <Chips cats={cats} dashed />
        </Tile>
      )
    case 'players_out':
      return (
        <Tile icon="plus" title="Short-handed" sr={f.text}>
          <Big value={f.count ?? 0} unit="players out" />
        </Tile>
      )
    case 'consolidate':
      return (
        <Tile icon="arrow" title="Consolidates" sr={f.text}>
          <Big value={`${(f.count ?? 1) + 1} → 1`} unit="roster spots" />
        </Tile>
      )
    case 'paper_win':
      return (
        <Tile icon="up" title="They win on paper" sr={f.text}>
          <Big value={`${Math.round((f.ratio ?? 1) * 100)}%`} unit="of the value they send" />
        </Tile>
      )
    case 'roster_squeeze':
      return (
        <Tile icon="warn" tone="against" title="Roster squeeze" sr={f.text}>
          <Big value={f.count ?? 1} unit={(f.count ?? 1) === 1 ? 'player they cut' : 'players they cut'} />
          <div className="small muted">Accepted about half as often as a 1-for-1</div>
        </Tile>
      )
    case 'keystone_lost':
      return (
        <Tile icon="warn" tone="against" title="Takes their keystone" sr={f.text}>
          <Chips cats={cats} />
        </Tile>
      )
    case 'punt_mine':
      return (
        <Tile icon="check" title="Costs you little" sub={f.player_name} sr={f.text}>
          <div className="small muted">His value is in your punts</div>
          <Chips cats={cats} dashed />
        </Tile>
      )
    case 'punt_theirs':
      return (
        <Tile icon="check" title="Wasted on them" sub={f.player_name} sr={f.text}>
          <div className="small muted">They punt</div>
          <Chips cats={cats} dashed />
        </Tile>
      )
    case 'not_rival':
      return (
        <Tile icon="check" title="Not a playoff rival" sr={f.text}>
          <div className="small muted">Helping them doesn't cost you a spot</div>
        </Tile>
      )
    default:
      return (
        <Tile icon="check" title={f.text} sr={f.text}>
          {null}
        </Tile>
      )
  }
}

type Icon = 'up' | 'down' | 'bars' | 'check' | 'plus' | 'arrow' | 'warn'

const ICON_PATHS: Record<Icon, string> = {
  up: 'M2 10l4-4 2 2 4-4M9 4h3v3',
  down: 'M2 4l4 4 2-2 4 4M9 10h3V7',
  bars: 'M3 12V7M7 12V3M11 12V9',
  check: 'M2.5 7.5l3 3 6-7',
  plus: 'M7 2v10M2 7h10',
  arrow: 'M2 7h10M8 3l4 4-4 4',
  warn: 'M7 3v5M7 10.5v.5',
}

function Tile({
  icon,
  title,
  sub,
  sr,
  tone = 'for',
  children,
}: {
  icon: Icon
  title: string
  sub?: string | null
  sr: string
  tone?: 'for' | 'against'
  children: ReactNode
}) {
  return (
    <li className={`rt-tile rt-${tone}`}>
      <span className="sr-only">{sr}</span>
      <div className="rt-head" aria-hidden="true">
        <span className="rt-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICON_PATHS[icon]} />
          </svg>
        </span>
        <span className="rt-title">
          <span>{title}</span>
          {sub && <span className="rt-sub">{sub}</span>}
        </span>
      </div>
      <div className="rt-body" aria-hidden="true">
        {children}
      </div>
    </li>
  )
}

/** Two values as bars on one scale; the one the point is about is drawn in the accent. */
function Pair({ rows }: { rows: [string, number, string, boolean][] }) {
  const max = Math.max(...rows.map((r) => r[1]), 1)
  return (
    <div className="rt-pair">
      {rows.map(([label, v, text, hi]) => (
        <div key={label} className="rt-pair-row">
          <span className="small muted">{label}</span>
          <span className="rt-track">
            <span className={hi ? 'rt-fill rt-hi' : 'rt-fill'} style={{ width: `${Math.max(4, (100 * v) / max)}%` }} />
          </span>
          <span className="num rt-val">{text}</span>
        </div>
      ))}
    </div>
  )
}

/** Signed values around a center line: right and green for gains, left and red for losses. */
function Diverging({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => Math.abs(r[1])), 0.5)
  return (
    <div className="rt-pair">
      {rows.map(([label, v]) => (
        <div key={label} className="rt-pair-row">
          <span className="small muted">{label}</span>
          <span className="rt-track rt-div">
            <span
              className={v >= 0 ? 'rt-fill rt-pos' : 'rt-fill rt-neg'}
              style={{ width: `${(50 * Math.abs(v)) / max}%`, [v >= 0 ? 'left' : 'right']: '50%' }}
            />
          </span>
          <span className={`num rt-val ${v >= 0 ? 'good' : 'bad'}`}>{signed(v)}</span>
        </div>
      ))}
    </div>
  )
}

/** The league table as a strip: one block per team, theirs lit, a line under the last playoff spot. */
function Standing({ rank, teams, spots }: { rank: number; teams: number; spots: number }) {
  return (
    <div className="rt-standing">
      {Array.from({ length: teams }, (_, i) => (
        <span key={i} className="rt-slot-wrap">
          <span className={i + 1 === rank ? 'rt-slot rt-me' : 'rt-slot'} />
          {i + 1 === spots && <span className="rt-line" />}
        </span>
      ))}
    </div>
  )
}

function Chips({ cats, dashed = false }: { cats: string[]; dashed?: boolean }) {
  return (
    <div className="rt-chips">
      {cats.map((c) => (
        <span key={c} className={dashed ? 'rt-chip rt-dashed num' : 'rt-chip num'}>
          {c}
        </span>
      ))}
    </div>
  )
}

function Big({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <div className="rt-bigline">
      <span className="num rt-big">{value}</span>
      <span className="small muted">{unit}</span>
    </div>
  )
}

function signed(x: number) {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`
}
