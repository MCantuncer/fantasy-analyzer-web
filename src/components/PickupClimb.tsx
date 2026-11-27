import { useId, type ReactNode } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import type { PlayerRef } from '../api/client'
import { climb, sCurve } from '../lib/climb'
import { END_GAP, evenLabelTop } from '../lib/climbLabels'
import { pct, ptsDiff, signedInt } from '../lib/format'
import { InjuryBadges } from './InjuryBadges'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import { DeltaChip } from './TradeTable'
import './PickupClimb.css'

const END_FACE = 48
const DROP_FACE = 44

function Who({
  label,
  icon: LaneIcon,
  player,
  note,
  align,
  face,
}: {
  label: string
  icon: typeof Plus
  player: PlayerRef
  note?: ReactNode
  align: 'start' | 'end'
  face?: number
}) {
  return (
    <div className={`pclimb-who pclimb-${align}`}>
      {face && <PlayerHead player={player} size={face} team={player.pro_team} />}
      <div className="pclimb-who-text">
        <span className="bm-lane-label">
          <LaneIcon size={14} weight="bold" aria-hidden="true" />
          {label}
        </span>
        <span className="bm-name">
          <PlayerLink player={player} after={<InjuryBadges players={[player]} />} />
        </span>
        <span className="pclimb-meta">
          <span className="code">{[player.pro_team, player.positions.join('/')].filter(Boolean).join(' · ')}</span>
          {note && <span className="pclimb-note">{note}</span>}
        </span>
      </div>
    </div>
  )
}

/** "Faint: the 3 other pickups checked today", or what is left of it when fewer are drawn. */
function caption(drawn: number, scored: number): string {
  const pickups = scored === 1 ? 'pickup' : 'pickups'
  if (drawn === 0) return `None of the ${scored} other ${pickups} checked today raises your odds`
  if (drawn < scored) return `Faint: some of the ${scored} other ${pickups} checked today`
  return `Faint: the ${scored} other ${pickups} checked today`
}

/**
 * The free-agent move as a calm climb: one green line from today's odds (a hollow dot, "56%
 * today") to the odds after the pickup (a solid dot under "57%", the ▲ chip and the added player's
 * face), with a soft green fade under it. Faint strands are the other straight add/drops the
 * analysis scored, each ending at its own odds and labelled with its own gain. No grid and no
 * ticks: the zoomed window is stated once in the header, and the 50% line is the only rule.
 */
export function PickupClimb({
  add,
  drop,
  before,
  after,
  others,
  label = 'Your playoff odds',
  addNote,
  dropNote,
  owner = 'Your',
  lanes = true,
}: {
  add: PlayerRef
  drop: PlayerRef
  before: number
  after: number
  others: number[]
  label?: string
  addNote?: ReactNode
  dropNote?: ReactNode
  /** Whose odds, for the screen-reader sentence ("Your", "Horns'"). */
  owner?: string
  /** Draws the Add and Drop lanes around the chart; off when the card shows them itself. */
  lanes?: boolean
}) {
  const id = useId()
  const c = climb({ before, after, others, seed: `${add.id}/${drop.id}` })
  const diff = ptsDiff(before, after)
  const evenTop = evenLabelTop(c)
  const scored = others.length
  const beaten = others.filter((o) => ptsDiff(before, o) < diff).length
  const x0 = c.start.x * 1000
  const x1 = c.end.x * 1000
  const line = sCurve(x0, c.start.y, x1, c.end.y)
  const fade = `${line} L${x1} ${c.height} L${x0} ${c.height} Z`

  const zoom = (
    <span className="pclimb-zoom">
      zoomed to{' '}
      <span className="num">
        {c.lo}–{c.hi}%
      </span>
    </span>
  )

  return (
    <div className="pclimb">
      {lanes ? (
        <div className="pclimb-top">
          <div className="pclimb-axis">
            <span className="pclimb-label">{label}</span>
            {zoom}
          </div>
          <Who label="Add" icon={Plus} player={add} note={addNote} align="end" />
        </div>
      ) : (
        <div className="pclimb-head">
          <span className="pclimb-label">{label}</span>
          {zoom}
        </div>
      )}

      <div className="pclimb-plot" style={{ height: c.height }}>
        <p className="sr-only">
          {owner} playoff odds go from {pct(before)} today to {pct(after)} with {add.name} for {drop.name},{' '}
          {diff >= 0 ? 'up' : 'down'} {Math.abs(diff)} points.
          {scored > 0 && ` It beats ${beaten} of the ${scored} other pickups checked today.`}
        </p>
        <div className="pclimb-art" aria-hidden="true">
          <svg className="pclimb-svg" viewBox={`0 0 1000 ${c.height}`} preserveAspectRatio="none" focusable="false">
            <defs>
              {/* Green from the line down, gone by 70% of the depth; faded in from the left. */}
              <linearGradient id={`${id}-down`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--good)" stopOpacity="1" />
                <stop offset="0.7" stopColor="var(--good)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${id}-across`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="1" />
              </linearGradient>
              <mask id={`${id}-in`} maskContentUnits="objectBoundingBox">
                <rect x="0" y="0" width="1" height="1" fill={`url(#${id}-across)`} />
              </mask>
            </defs>
            {c.even != null && <line x1={0} x2={1000} y1={c.even} y2={c.even} className="pclimb-even" />}
            {after > before && (
              <path d={fade} className="pclimb-fade" fill={`url(#${id}-down)`} mask={`url(#${id}-in)`} />
            )}
            {c.strands.map((s, k) => (
              <path key={k} d={sCurve(x0, c.start.y, s.x * 1000, s.y)} className="pclimb-strand" />
            ))}
            <path d={line} className="pclimb-line" pathLength={1} />
          </svg>
          {c.strands.map((s, k) => (
            <i key={k} className="pclimb-sdot" style={{ left: `${s.x * 100}%`, top: s.y }} />
          ))}
          <i className="pclimb-dot now" style={{ left: `${c.start.x * 100}%`, top: c.start.y }} />
          <i className="pclimb-dot after" style={{ left: `${c.end.x * 100}%`, top: c.end.y }} />
          {evenTop != null && (
            <span className="pclimb-even-label" style={{ top: evenTop }}>
              <span className="num">50%</span> · even odds
            </span>
          )}
          {c.groups.map((g) => (
            <span key={g.pct} className="pclimb-gain num" style={{ top: g.y }}>
              {signedInt(g.gain)}
            </span>
          ))}
          <span className="pclimb-now" style={{ left: `calc(${c.start.x * 100}% - 6px)`, top: c.start.y + 14 }}>
            <b className="num">{pct(before)}</b>
            <span>today</span>
          </span>
          <span
            className="pclimb-end-fig"
            style={{ left: `calc(${c.end.x * 100}% + 24px)`, bottom: `calc(100% - ${c.end.y - END_GAP}px)` }}
          >
            <span className="pclimb-end-figs">
              <span className="pclimb-pct num">
                {Math.round(after * 100)}
                <small>%</small>
              </span>
              <DeltaChip before={before} after={after} />
            </span>
            <PlayerHead player={add} size={END_FACE} team={add.pro_team} />
          </span>
          {scored > 0 && <span className="pclimb-cap">{caption(c.strands.length, scored)}</span>}
        </div>
      </div>

      {lanes && <Who label="Drop" icon={Trash} player={drop} note={dropNote} align="start" face={DROP_FACE} />}
    </div>
  )
}
