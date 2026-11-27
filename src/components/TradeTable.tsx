import { ArrowDownLeft, ArrowUpRight, Copy, PaperPlaneTilt, Scales } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import type { ShopDeal } from '../api/client'
import { ordinal, pct, ptsDiff, signed, signedInt } from '../lib/format'
import { shortValue, type RoundValues } from '../lib/tradeValue'
import type { Want } from '../lib/tradeTable'
import { Spinner } from './Spinner'
import { TeamCrest } from './TeamCrest'
import './TradeTable.css'

type PitchNeed = NonNullable<ShopDeal['pitch_needs']>[number]

export interface TradeTableProps {
  /** Accessible name of the table, e.g. "Trading for Evan Mobley". */
  label: string
  /**
   * The end that carries the light and leads on narrow screens: 'give' for Trade Park (your end,
   * the warm house light), 'get' for Trade For (their end, the faint partner violet).
   */
  lit: 'give' | 'get'
  /** The centre line: an OddsPlate. On narrow screens it becomes the odds band across. */
  odds: ReactNode
  /** Your end (left): what you give. */
  give: ReactNode
  /** Their end (right): what you get. */
  get: ReactNode
  /** A second block under the get end, beside a tall give end (Trade For's category strip). */
  get2?: ReactNode
  /** The table foot, across all three columns. */
  foot?: ReactNode
  /** Before anything is picked: on narrow screens the odds band leads, above both ends. */
  oddsFirst?: boolean
  /** A newer result is loading while the last one stays on screen: sets aria-busy. */
  busy?: boolean
  /** One sentence for screen readers when the result changes, e.g. "Best deal: Allen for Thompson, odds 54 to 56". */
  announce?: string
}

/**
 * One trading table seen from either end: you give on the left, you get on the right, and your
 * playoff odds sit on the centre line between them. Under 900px it turns into one column: the lit
 * end, the odds band, then the other end (or the odds band first, before a pick).
 *
 * The ends come in the narrow reading order, so phones read and tab top to bottom; wider screens
 * place them by grid area.
 */
export function TradeTable({ label, lit, odds, give, get, get2, foot, oddsFirst = false, busy = false, announce }: TradeTableProps) {
  const ends = {
    give: (
      <div key="give" className={lit === 'give' ? 'tt-end tt-give tt-lit' : 'tt-end tt-give'}>
        {give}
      </div>
    ),
    get: (
      <div key="get" className={lit === 'get' ? 'tt-end tt-get tt-lit' : 'tt-end tt-get'}>
        {get}
      </div>
    ),
  }
  const mid = (
    <div key="mid" className="tt-mid">
      {odds}
    </div>
  )
  const second = get2 ? (
    <div key="get2" className="tt-end tt-get2">
      {get2}
    </div>
  ) : null
  const other = lit === 'give' ? 'get' : 'give'
  const order = oddsFirst ? [mid, ends[lit], second, ends[other]] : [ends[lit], mid, second, ends[other]]
  const cls = ['tt', `tt-lit-${lit}`, oddsFirst ? 'tt-odds-first' : '', get2 ? 'tt-has-get2' : ''].filter(Boolean).join(' ')
  return (
    <section className={cls} aria-label={label} aria-busy={busy || undefined}>
      {order}
      {foot && <div className="tt-foot">{foot}</div>}
      <p className="sr-only" role="status" aria-live="polite">
        {announce ?? ''}
      </p>
    </section>
  )
}

export interface OddsPlateProps {
  /** What the number is, e.g. "Your playoff odds" or "Your odds with him". */
  label: string
  /** The big number, as a fraction: the odds after the deal, or today's odds before one. */
  value: number
  /** Today's odds, when value is an after-number: adds "from X%" and the delta chip. */
  from?: number | null
  /** The line under the number when there is no from, e.g. "today · 6th best of 10". */
  sub?: ReactNode
  /** The other team's odds before and after the deal: "Them 47% → 46%". */
  them?: { before: number; after: number } | null
  /** A short note in small type, e.g. "Ceiling: he comes free, Neemias Queta goes". */
  note?: ReactNode
  /** A working line with a spinner, e.g. "Finding deals" or "Updating". */
  status?: string | null
}

/**
 * The odds on the centre line: a label, the big number, "from X%" with a delta chip (a sign and
 * a small arrow, never colour alone), and optional lines for the other team, a note and a status.
 */
export function OddsPlate({ label, value, from, sub, them, note, status }: OddsPlateProps) {
  return (
    <div className="tt-plate">
      <span className="tt-plate-k">{label}</span>
      <span className="tt-plate-big num">{pct(value)}</span>
      {from != null && (
        <span className="tt-plate-from num">
          from <b>{pct(from)}</b>
        </span>
      )}
      {from != null && <DeltaChip before={from} after={value} />}
      {from == null && sub && <span className="tt-plate-from">{sub}</span>}
      {them && (
        <span className="tt-plate-them num">
          Them {pct(them.before)} → {pct(them.after)}
        </span>
      )}
      {note && <span className="tt-plate-note">{note}</span>}
      {status && (
        <span className="tt-plate-status">
          <Spinner size={14} />
          {status}
        </span>
      )}
    </div>
  )
}

/** "▲ +2 pts" on a soft good, bad or neutral chip. */
export function DeltaChip({ before, after }: { before: number; after: number }) {
  const diff = ptsDiff(before, after)
  const tone = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  return (
    <span className={`tt-chip tt-chip-${tone} num`}>
      {diff !== 0 && (
        <span className="tt-chip-ar" aria-hidden="true">
          {diff > 0 ? '▲' : '▼'}
        </span>
      )}
      {signedInt(diff)} pts
    </span>
  )
}

/** The head of one end: "↗ You give" or "↙ You get", with a slot on the right. */
export function EndLabel({ end, children }: { end: 'give' | 'get'; children?: ReactNode }) {
  const Icon = end === 'give' ? ArrowUpRight : ArrowDownLeft
  return (
    <div className="tt-end-label">
      <span className="tt-end-name">
        <Icon size={16} aria-hidden="true" />
        {end === 'give' ? 'You give' : 'You get'}
      </span>
      {children}
    </div>
  )
}

/** A team in a "Strong there" crest stack. */
export interface CrestTeam {
  id: number
  name: string
  colour?: string
}

export interface WantsProps {
  /** The categories to aim at (wantedCategories), each with its weekly win chance. */
  wants: Want[]
  /** Teams strong in each category, shown as "Strong there" crests; leave out to hide the line. */
  strong?: Record<string, CrestTeam[]>
}

/** Your close categories as flat stats: "AST 41% weekly win", the close one marked "Close". */
export function Wants({ wants, strong }: WantsProps) {
  return (
    <ul className="tt-wants">
      {wants.map((w) => {
        const teams = strong?.[w.category] ?? []
        return (
          <li key={w.category} className={w.close ? 'tt-want tt-want-close' : 'tt-want'}>
            <span className="tt-want-c">
              {w.category}
              {w.close && <em>Close</em>}
            </span>
            <span className="tt-want-v num">{pct(w.winPct)}</span>
            <span className="tt-want-u">weekly win</span>
            {strong && (
              <span className="tt-want-where">
                {teams.length > 0 ? (
                  <>
                    Strong there
                    <span className="tt-crests">
                      {teams.slice(0, 3).map((t) => (
                        <TeamCrest key={t.id} name={t.name} colour={t.colour} size={20} />
                      ))}
                    </span>
                    <span className="sr-only">: {teams.map((t) => t.name).join(', ')}</span>
                  </>
                ) : (
                  'No team strong there'
                )}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// What the per-game number counts, for the line under it.
const UNIT: Record<string, string> = {
  PTS: 'points a game',
  REB: 'rebounds a game',
  AST: 'assists a game',
  STL: 'steals a game',
  BLK: 'blocks a game',
  '3PM': '3s a game',
  TO: 'turnovers a game',
}
const LONG: Record<string, string> = {
  'FG%': 'field goal %',
  'FT%': 'free throw %',
  TO: 'turnovers',
  '3PM': '3s',
}

export interface TheirSideProps {
  /** Their team name, for "Your pitch to {team}". */
  partner: string
  /** The sentence Copy pitch copies. */
  pitch: string
  /** The pitch as data: one column per category the deal helps them in. */
  needs?: PitchNeed[] | null
  /** League size, for "7th of 10". */
  teams?: number
  /** Trade value they get and give: "On paper they get" as a %, or "Trade value" when they give nothing on paper. */
  valueGet: number
  valueGive: number
  /** Their expected categories won a week, change. */
  theirCats: number
  rounds: RoundValues
  /** Buttons after Copy pitch, e.g. Check This Trade. */
  actions?: ReactNode
  /** More rows for the facts list, ahead of the value rows: each a <div> with a <dt> and a <dd>. */
  facts?: ReactNode
}

/**
 * The deal from their side, flat: the pitch as columns, "Sends as …", Copy pitch (plus the
 * caller's actions) and a short list of facts.
 */
export function TheirSide({
  partner,
  pitch,
  needs,
  teams,
  valueGet,
  valueGive,
  theirCats,
  rounds,
  actions,
  facts,
}: TheirSideProps) {
  const list = needs ?? []
  const paper = valueGive > 0 ? Math.round((valueGet / valueGive) * 100) : null
  return (
    <div className="tt-side">
      <h3 className="tt-side-h">
        <PaperPlaneTilt size={18} aria-hidden="true" />
        Your pitch to {partner}
      </h3>
      {list.length > 0 ? (
        <ul className="tt-pitch">
          {list.map((n) => (
            <PitchColumn key={n.category} need={n} teams={teams} />
          ))}
        </ul>
      ) : (
        <p className="tt-sends">Balances your roster without costing you a category.</p>
      )}
      {list.length > 0 && (
        <p className="tt-sends">
          <b>Sends as</b> <q>{pitch}</q>
        </p>
      )}
      <div className="tt-actions">
        <CopyPitch text={pitch} />
        {actions}
      </div>
      <div>
        <h3 className="tt-side-h">
          <Scales size={18} aria-hidden="true" />
          Their side of the deal
        </h3>
        <dl className="tt-facts">
          {facts}
          {paper != null && (
            <div>
              <dt>On paper they get</dt>
              <dd className="num">
                <span className={paper >= 100 ? 'good' : undefined}>{paper}%</span> <small>of what they send</small>
              </dd>
            </div>
          )}
          {/* The same comparison as the % row, in rounded dollars that can read as a tie: only without it. */}
          {paper == null && (
            <div>
              <dt>Trade value</dt>
              <dd className="num">
                {shortValue(valueGet, rounds)} for {shortValue(valueGive, rounds)}
              </dd>
            </div>
          )}
          <div>
            <dt>Their categories a week</dt>
            <dd className={`num ${theirCats > 0 ? 'good' : theirCats < 0 ? 'bad' : ''}`}>{signed(theirCats)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function PitchColumn({ need: n, teams }: { need: PitchNeed; teams?: number }) {
  const turnover = n.category === 'TO'
  // per_game is the gain, already flipped for TO: shown as fewer turnovers.
  const big = n.per_game == null ? 'Improves' : `${turnover ? '−' : '+'}${n.per_game.toFixed(1)}`
  const unit = n.per_game == null ? `their ${LONG[n.category] ?? n.category}` : (UNIT[n.category] ?? 'a game')
  return (
    <li className="tt-pcol">
      <span className="tt-pcol-h">
        {n.category}
        <span className="num">
          {ordinal(n.league_rank)}
          {teams ? ` of ${teams}` : ''}
        </span>
      </span>
      <span className={n.per_game == null ? 'tt-pcol-v' : 'tt-pcol-v num'}>{big}</span>
      <span className="tt-pcol-u">{unit}</span>
    </li>
  )
}

function CopyPitch({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="tt-btn tt-btn-primary"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          },
          () => undefined,
        )
      }}
    >
      <Copy size={18} aria-hidden="true" />
      <span aria-live="polite">{copied ? 'Copied' : 'Copy pitch'}</span>
    </button>
  )
}
