import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import type { CategoryScore } from '../api/client'
import { buildRows, isBench, isIR, starterTotals } from '../lib/myPlayers'
import type { PlayerRow, Totals as LineTotals } from '../lib/myPlayers'
import type { TodayData } from '../lib/todayData'
import { chipFor, leftOnBench, shortNames } from '../lib/todayMatchup'
import type { LeftOnBench } from '../lib/todayMatchup'
import { ColumnHead, EmptyRow, Field, Row, Slide, Totals, TotalsBeforeTip } from './QuietField'
import { Bone } from './Skeleton'
import { TeamCrest } from './TeamCrest'
import './TodayMatchup.css'

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
  totals: LineTotals
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
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (seek == null) return
    // Looked up inside this view: the same player can be on screen twice (your card and an open matchup).
    const el = root.current?.querySelector<HTMLElement>(`[data-tm-p='${seek}']`)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView?.({
      block: 'center',
      behavior: reduce ? 'auto' : 'smooth',
    })
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
  const names = shortNames(sides.flatMap((s) => s.rows.map((r) => r.spot.name)))
  const flag = sides[1].lob
    ? { side: sides[1], lob: sides[1].lob }
    : sides[0].lob
      ? { side: sides[0], lob: sides[0].lob }
      : null
  const shown = sides[view]

  return (
    <div className="tm" ref={root}>
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

      <TeamColumn key={shown.id} side={shown} />
    </div>
  )
}

/** "Lakers" from "Eryaman Lakers": the last word, which is what a team goes by. */
function shortTeam(name: string): string {
  const w = name.trim().split(/\s+/)
  return w[w.length - 1]
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

function TeamColumn({ side }: { side: Side }) {
  // One side shows at a time, so its names only need to be told apart from each other: "Thompson", not
  // "A. Thompson" because the other lineup has a Thompson too (that clipped on phones).
  const names = shortNames(side.rows.map((r) => r.spot.name))
  const starters: ReactNode[] = []
  const open = [...side.open]
  for (const r of side.starters) starters.push(<Row key={r.spot.player_id} row={r} names={names} />)
  open.forEach((slot, i) => starters.push(<EmptyRow key={`open-${i}`} slot={slot} />))
  const bench = side.rows.filter((r) => isBench(r.spot))
  const left = bench.filter((r) => r.line && r.line.minutes > 0)
  const playing = bench.filter((r) => !left.includes(r) && r.state !== 'idle')
  const idle = bench.filter((r) => r.state === 'idle')
  const ir = side.rows.filter((r) => isIR(r.spot))
  // Before any starter has played a minute there are no figures yet: no column head, no pager, no zeros.
  const pretip = !side.starters.some((r) => r.line && r.line.minutes > 0)
  const tips = side.starters.filter((r) => r.game && r.state === 'later').map((r) => r.game!.start)
  const firstTip = tips.length ? tips.sort()[0] : null
  return (
    <section
      className={`tm-col${side.mine ? ' mine' : ' theirs'}${pretip ? ' tm-pretip' : ''}`}
      aria-label={side.mine ? 'Your players' : `${side.name} players`}
    >
      <Slide starters={side.starters} pager={!pretip}>
        <>
          {!pretip && <ColumnHead />}
          {/* The starters and their total share one soft field; the bench sits on the bare page. */}
          <Field>
            <ol className="tm-list" aria-label="Starters">
              {starters}
            </ol>
            {pretip ? <TotalsBeforeTip firstTip={firstTip} /> : <Totals totals={side.totals} />}
          </Field>
          <h3 className="tm-sub">Bench</h3>
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

/** The shape of the Today view while the day's games and both lineups load. */
export const TodayLoading = (): ReactElement => (
  <div className="tm tm-loading" aria-busy="true" aria-label="Loading today's matchup">
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
