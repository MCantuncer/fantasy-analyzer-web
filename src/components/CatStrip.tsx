import type { CSSProperties, ReactNode } from 'react'
import { Target } from '@phosphor-icons/react'
import { barShare, pairCells, pairFigure, pairLabel, type PairCell, type StripSide } from '../lib/catStrip'
import { formatStat } from '../lib/league'
import { CATEGORY_ORDER } from '../lib/statOrder'
import { TeamCrest } from './TeamCrest'
import { YourCrest } from './YourCrest'
import './CatStrip.css'

export interface CatStripProps {
  /** Change in weekly win chance per category, as a fraction (0.09 is +9 points), keyed by category. */
  changes: Record<string, number>
  /** The heading over the strip, e.g. "What he does for you" or "Your weekly win chance". */
  title: string
  /** The line opposite the heading, e.g. "+0.07 categories won a week". */
  summary?: ReactNode
  /** Which categories get a column. Defaults to the keys of changes; always laid out in CATEGORY_ORDER. */
  categories?: readonly string[]
  /** The change that fills a bar's full 28px each way. Larger changes are capped there. */
  full?: number
}

const BAR = 28
const MIN_BAR = 3

function ordered(cats: readonly string[]): string[] {
  const known = CATEGORY_ORDER.filter((c) => cats.includes(c))
  return [...known, ...cats.filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c))]
}

/**
 * Change in weekly win chance per category as nine short columns: a 12px bar up or down from a
 * zero line, and the signed number of points under it (0 is muted). Screen readers hear one item
 * per category, "AST +9 points".
 */
export function CatStrip({ changes, title, summary, categories, full = 0.15 }: CatStripProps) {
  const cats = ordered(categories ?? Object.keys(changes))
  return (
    <div className="cs-wrap">
      <div className="cs-head">
        <span className="cs-title">{title}</span>
        {summary && <span className="cs-sum">{summary}</span>}
      </div>
      <ul className="cs" role="list" style={{ gridTemplateColumns: `repeat(${cats.length}, minmax(0, 1fr))` }}>
        {cats.map((c) => {
          const v = Math.round((changes[c] ?? 0) * 100)
          const h = v === 0 ? 0 : Math.max(MIN_BAR, Math.min(BAR, (Math.abs(v) / 100 / full) * BAR))
          const sign = v > 0 ? '+' : v < 0 ? '−' : ''
          return (
            <li key={c} aria-label={v === 0 ? `${c} no change` : `${c} ${sign}${Math.abs(v)} points`}>
              <span className="cs-c" aria-hidden="true">
                {c}
              </span>
              <span className="cs-bar" aria-hidden="true">
                {v !== 0 && <i className={v > 0 ? 'cs-up' : 'cs-down'} style={{ height: h }} />}
              </span>
              <span className={`cs-v num ${v > 0 ? 'good' : v < 0 ? 'bad' : 'cs-zero'}`} aria-hidden="true">
                {v === 0 ? '0' : `${sign}${Math.abs(v)}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export interface CatStripPairProps {
  /** The top row's team (you, in your own matchup). */
  a: StripSide
  b: StripSide
  /** Which figures sit on top and drive the bars: today's (Today view) or the week's. */
  top: 'today' | 'week'
  /** The small figures under each side: the week so far, or none. */
  sub?: 'week' | null
  /** Which row is you. Bars are green/coral (good or bad for you) only when set; neutral otherwise. */
  mine: 'a' | null
  /** The key column: crest + name (default), crest only, or none. */
  keyed?: 'name' | 'crest' | false
  /** The list's accessible name, e.g. "Today's categories, with the week so far". */
  label: string
  /** Flag categories that are close this week (amber label + Target). Off for a strip without a week. */
  close?: boolean
}

const statLabel = (stat: string) => (stat === 'TO' ? 'TO↓' : stat)

function PairBar({ cell, mine }: { cell: PairCell; mine: 'a' | null }) {
  if (cell.leader === 'none') return null
  if (cell.leader === 'tie') return <i className="cs-tie" />
  const dir = cell.leader === 'a' ? 'cs-pup' : 'cs-pdn'
  const tone = mine == null ? 'cs-neu' : cell.leader === mine ? 'cs-good' : 'cs-bad'
  return <i className={`${dir} ${tone}`} style={{ '--share': barShare(cell).toFixed(3) } as CSSProperties} />
}

function KeySide({ side, isMe, sub }: { side: StripSide; isMe: boolean; sub: boolean }) {
  return (
    <>
      <span className="cs-who">
        <YourCrest name={side.name} colour={side.colour} size={18} mine={isMe} />
        <span className="cs-nm">{side.short}</span>
      </span>
      {sub && (
        <span className="cs-wk">
          <span className="cs-lg">this week</span>
          <span className="cs-sm">wk</span>
        </span>
      )}
    </>
  )
}

/**
 * Two teams' categories as a line score: per category, the top team's figure, a bar from a short
 * zero tick toward whoever leads (its length is the margin, from leadReach), and the other team's
 * figure, each with an optional small week figure under it. Close categories (isClose on the
 * week) get an amber label and a Target. Screen readers hear one item per category with the
 * whole reading.
 */
export function CatStripPair({ a, b, top, sub = null, mine, keyed = 'name', label, close = true }: CatStripPairProps) {
  const cells = pairCells(a, b, { top, sub, closeFrom: close ? 'week' : null })
  const hasSub = sub != null
  const names = { a: mine === 'a' ? 'you' : a.short, b: b.short }
  const cls = ['cs-pair', hasSub ? '' : 'cs-one', keyed === 'crest' ? 'cs-crestkey' : '', keyed ? '' : 'cs-nokey']
    .filter(Boolean)
    .join(' ')
  const weight = (cellLeader: string, side: 'a' | 'b') => (cellLeader === side ? ' cs-w' : '')
  return (
    <div className={cls} role="list" aria-label={label} style={{ '--n': cells.length } as CSSProperties}>
      {keyed && (
        <div className="cs-key" aria-hidden="true">
          <span />
          <KeySide side={a} isMe={mine === 'a'} sub={hasSub} />
          <span />
          <KeySide side={b} isMe={false} sub={hasSub} />
        </div>
      )}
      {cells.map((cell) => (
        <div key={cell.stat} className="cs-pi" role="listitem" aria-label={pairLabel(cell, names)}>
          <span
            className={cell.close ? 'cs-pl cs-close' : 'cs-pl'}
            title={cell.close ? 'Close this week, can flip' : undefined}
            aria-hidden="true"
          >
            {cell.close && <Target className="cs-ic" aria-hidden="true" />}
            {statLabel(cell.stat)}
          </span>
          <span className={`cs-pv num${weight(cell.leader, 'a')}`} aria-hidden="true">
            {pairFigure(cell.stat, cell.a)}
          </span>
          {hasSub && (
            <span className={`cs-pk num${weight(cell.subLeader, 'a')}`} aria-hidden="true">
              {pairFigure(cell.stat, cell.aSub)}
            </span>
          )}
          <span className="cs-pb" aria-hidden="true">
            <PairBar cell={cell} mine={mine} />
          </span>
          <span className={`cs-pv num${weight(cell.leader, 'b')}`} aria-hidden="true">
            {pairFigure(cell.stat, cell.b)}
          </span>
          {hasSub && (
            <span className={`cs-pk num${weight(cell.subLeader, 'b')}`} aria-hidden="true">
              {pairFigure(cell.stat, cell.bSub)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/** One projected category for CatStrip `pick`: both projected figures and who's projected to take it. */
export interface PickRow {
  stat: string
  mine: number
  theirs: number
  winner: 'me' | 'them'
  /** It could still go either way. */
  close: boolean
}

export interface PickSide {
  name: string
  colour: string | undefined
}

/**
 * CatStrip's `pick` variant (the Projected final): per category, the crest of the team projected
 * to take it and both projected figures under it, the winner's in ink. The same nine columns (and
 * key gutter) as the pair strip above it, so the categories line up. Plain labels: the amber close
 * mark belongs to the strip above, and the two projected figures already show how close it is.
 */
export function CatStripPick({
  rows,
  me,
  them,
  label,
}: {
  rows: readonly PickRow[]
  me: PickSide
  them: PickSide
  label: string
}) {
  const order = stripCategoriesOf(rows)
  return (
    <div className="cs-pair cs-pick" role="list" aria-label={label} style={{ '--n': order.length } as CSSProperties}>
      <span className="cs-pkey" aria-hidden="true" />
      {order.map((r) => {
        const side = r.winner === 'me' ? me : them
        const said = `${r.stat}: you ${formatStat(r.stat, r.mine)}, ${them.name} ${formatStat(r.stat, r.theirs)}, ${
          r.winner === 'me' ? 'you take it' : `${them.name} take it`
        }`
        return (
          <div key={r.stat} className="cs-ki" role="listitem" aria-label={said}>
            <span className="cs-pl" aria-hidden="true">
              {statLabel(r.stat)}
            </span>
            <span className="cs-kc" aria-hidden="true">
              <TeamCrest name={side.name} colour={side.colour} size={26} />
            </span>
            <span className="cs-kv num" aria-hidden="true">
              <span className={r.winner === 'me' ? 'cs-w' : undefined}>{formatStat(r.stat, r.mine)}</span>
              <i>·</i>
              <span className={r.winner === 'them' ? 'cs-w' : undefined}>{formatStat(r.stat, r.theirs)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function stripCategoriesOf(rows: readonly PickRow[]): PickRow[] {
  const by = new Map(rows.map((r) => [r.stat, r]))
  const known = CATEGORY_ORDER.filter((c) => by.has(c)).map((c) => by.get(c)!)
  return [...known, ...rows.filter((r) => !(CATEGORY_ORDER as readonly string[]).includes(r.stat))]
}
