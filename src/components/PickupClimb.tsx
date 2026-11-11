import type { ReactNode } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import type { PlayerRef } from '../api/client'
import { climb, sCurve } from '../lib/climb'
import { pct, ptsDiff, signedInt } from '../lib/format'
import { InjuryBadges } from './InjuryBadges'
import { Delta } from './OddsChange'
import { PlayerHead } from './PlayerHead'
import { PlayerLink } from './PlayerCard'
import './PickupClimb.css'

const AFTER_FACE = 64
const NOW_FACE = 44
const LABEL_H = 16

function Who({
  label,
  icon: LaneIcon,
  player,
  note,
  align,
}: {
  label: string
  icon: typeof Plus
  player: PlayerRef
  note?: ReactNode
  align: 'start' | 'end'
}) {
  return (
    <div className={`pclimb-who pclimb-${align}`}>
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
  )
}

/**
 * The free-agent move as a climb ("The field"): you leave the dropped player at today's odds and
 * rise to the added player's. Faint strands are the other straight add/drops the analysis scored,
 * each ending at its own odds and labelled with its own gain, so the lit line shows how far it
 * beats them. The scale is zoomed and says so, with its ticks; 50% is labelled even odds, not
 * the playoff line.
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
}) {
  const c = climb({ before, after, others })
  const diff = ptsDiff(before, after)
  const afterTop = c.end.y - 14 - AFTER_FACE
  const nowTop = c.start.y + 12
  // The even-odds label goes above its line, else below it, else only the bold 50 tick shows.
  const clash = (top: number) =>
    (top < c.end.y - 14 && top + LABEL_H > afterTop) || (top < nowTop + NOW_FACE && top + LABEL_H > nowTop)
  const evenTop =
    c.even == null ? null : !clash(c.even - LABEL_H - 2) ? c.even - LABEL_H - 2 : !clash(c.even + 3) ? c.even + 3 : null
  const scored = others.length
  const beaten = others.filter((o) => ptsDiff(before, o) < diff).length

  return (
    <div className="pclimb">
      <div className="pclimb-top">
        <div className="pclimb-axis">
          <span className="kpi-label">{label}</span>
          <span className="pclimb-zoom">
            zoomed to{' '}
            <span className="num">
              {c.lo}–{c.hi}%
            </span>
          </span>
        </div>
        <Who label="Add" icon={Plus} player={add} note={addNote} align="end" />
      </div>

      <div className="pclimb-plot" style={{ height: c.height }}>
        <p className="sr-only">
          Drop {drop.name}, add {add.name}: {owner} playoff odds {pct(before)} to {pct(after)},{' '}
          {diff >= 0 ? 'up' : 'down'} {Math.abs(diff)} points.
          {scored > 0 && ` It beats ${beaten} of the ${scored} other pickups checked today.`}
        </p>
        <div className="pclimb-art" aria-hidden="true">
          {c.ticks.map((t) => (
            <span
              key={t.pct}
              className={t.pct === 50 ? 'pclimb-tick even num' : 'pclimb-tick num'}
              style={{ top: t.y }}
            >
              {t.pct}
            </span>
          ))}
          <svg className="pclimb-svg" viewBox={`0 0 1000 ${c.height}`} preserveAspectRatio="none" focusable="false">
            {c.ticks
              .filter((t) => t.pct !== 50)
              .map((t) => (
                <line key={t.pct} x1={80} x2={1000} y1={t.y} y2={t.y} className="pclimb-grid" />
              ))}
            {c.even != null && <line x1={80} x2={1000} y1={c.even} y2={c.even} className="pclimb-even" />}
            {c.strands.map((s, k) => (
              <path key={k} d={sCurve(c.start.x * 1000, c.start.y, s.x * 1000, s.y)} className="pclimb-strand" />
            ))}
            <path
              d={sCurve(c.start.x * 1000, c.start.y, c.end.x * 1000, c.end.y)}
              className="pclimb-line"
              pathLength={1}
            />
          </svg>
          {c.strands.map((s, k) => (
            <i key={k} className="pclimb-sdot" style={{ left: `${s.x * 100}%`, top: s.y }} />
          ))}
          <i className="pclimb-dot now" style={{ left: `${c.start.x * 100}%`, top: c.start.y }} />
          <i className="pclimb-dot after" style={{ left: `${c.end.x * 100}%`, top: c.end.y }} />
          {evenTop != null && (
            <span className="pclimb-even-label" style={{ top: evenTop }}>
              50% · even odds
            </span>
          )}
          {c.groups.map((g) => (
            <span key={g.pct} className="pclimb-gain num" style={{ top: g.y }}>
              {signedInt(g.gain)}
            </span>
          ))}
          {scored > 0 && (
            <span className="pclimb-cap" style={{ top: c.ticks[0].y + 6 }}>
              {c.strands.length < scored ? `Faint: the closest of the ${scored}` : `Faint: the ${scored} other`}
              <br />
              {c.strands.length < scored ? 'other pickups checked today' : 'pickups checked today'}
            </span>
          )}

          <span
            className="pclimb-after"
            style={{
              top: afterTop,
              right: `calc(${(1 - c.end.x) * 100}% - ${AFTER_FACE / 2}px)`,
            }}
          >
            <span className="pclimb-after-figs">
              <span className={diff >= 0 ? 'pclimb-delta good num' : 'pclimb-delta bad num'}>
                <Delta value={diff} unit="pts" />
              </span>
              <span className="pclimb-pct num">
                {Math.round(after * 100)}
                <small>%</small>
              </span>
            </span>
            <PlayerHead player={add} size={AFTER_FACE} team={add.pro_team} />
          </span>
          <span
            className="pclimb-now"
            style={{
              top: nowTop,
              left: `calc(${c.start.x * 100}% - ${NOW_FACE / 2}px)`,
            }}
          >
            <PlayerHead player={drop} size={NOW_FACE} team={drop.pro_team} />
            <span className="pclimb-now-figs">
              <span className="pclimb-cap-now">now</span>
              <span className="pclimb-pct now num">
                {Math.round(before * 100)}
                <small>%</small>
              </span>
            </span>
          </span>
        </div>
      </div>

      <Who label="Drop" icon={Trash} player={drop} note={dropNote} align="start" />
    </div>
  )
}
