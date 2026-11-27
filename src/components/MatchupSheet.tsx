import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Target } from '@phosphor-icons/react'
import type { CategoryScore } from '../api/client'
import { recText, shortTeam, todayLine, type Record3, type TodayLine } from '../lib/matchupSheet'
import { tipOff } from '../lib/scores'
import type { TodayData } from '../lib/todayData'
import { CatStripPair } from './CatStrip'
import { TodayLoading, TodayMatchup } from './TodayMatchup'
import { MaybeHandshake } from './MaybeHandshake'
import { YourCrest } from './YourCrest'
import './MatchupSheet.css'

/** One team on the sheet: who it is and its week so far (the overview's live score). */
export interface SheetSide {
  id: number
  name: string
  colour: string | undefined
  week: CategoryScore[]
  /** Games left this week, when the overview has it. */
  left?: number | null
}

export function TodayWeekSwitch({ view, onPick }: { view: 'today' | 'week'; onPick: (v: 'today' | 'week') => void }) {
  return (
    <div className="segmented lo-view" role="group" aria-label="Today or the whole week">
      {(['today', 'week'] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => onPick(v)}>
          {v === 'today' ? 'Today' : 'Week'}
        </button>
      ))}
    </div>
  )
}

const CATS = /(FG%|FT%|3PM|REB|AST|STL|BLK|TO|PTS)/

/** The shipped flip hint with its categories in ink: "Flip **FT%**, **AST** or **STL** to win the week". */
function hintWords(hint: string) {
  return hint.split(CATS).map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))
}

/**
 * The Week view's first line: what you can still flip (ink Target, the shipped flipHint) and a soft
 * Check a Trade With Them on the right. Renders nothing when there's neither.
 */
export function FlipLine({ hint, onCheckTrade }: { hint: string | null; onCheckTrade?: () => void }) {
  if (!hint && !onCheckTrade) return null
  return (
    <div className="lms-flip">
      {hint && (
        <p className="lms-hint">
          <Target size={18} aria-hidden="true" />
          <span>{hintWords(hint)}</span>
        </p>
      )}
      {onCheckTrade && (
        <button type="button" className="lms-check" onClick={onCheckTrade}>
          <MaybeHandshake size={20} /> Check a Trade With Them
        </button>
      )}
    </div>
  )
}

/** "6–3–0" with the digits in ink and the dashes light. */
function Score({ rec, quiet }: { rec: Record3; quiet?: boolean }) {
  return (
    <span className={`num lsb-big${quiet ? ' lsb-quiet' : ''}`} aria-hidden="true">
      {rec.wins}
      <i>–</i>
      {rec.losses}
      <i>–</i>
      {rec.ties}
    </span>
  )
}

function Side({
  side,
  mine,
  sub,
  theirs = false,
}: {
  side: SheetSide
  mine: boolean
  sub: ReactNode
  theirs?: boolean
}) {
  return (
    <div className={`lsb-side${theirs ? ' theirs' : ''}`}>
      <span className="lsb-crest">
        <YourCrest name={side.name} colour={side.colour} size={56} mine={mine} />
      </span>
      <span className="lsb-text">
        <b className="lsb-full">{side.name}</b>
        <b className="lsb-short">{mine ? 'You' : shortTeam(side.name)}</b>
        {sub && <span className="lsb-sub">{sub}</span>}
      </span>
    </div>
  )
}

function Status({ data, line }: { data: TodayData; line: TodayLine }) {
  return (
    <p className="lms-status">
      {line.live ? (
        <span className="lms-live">
          <span className="lms-dot" aria-hidden="true" />
          <b>Live</b>
        </span>
      ) : line.allFinal ? (
        <b className="lms-final">Final</b>
      ) : line.firstTip ? (
        <span>First tip {tipOff(line.firstTip)}</span>
      ) : null}
      <span>
        {data.stale ? 'Updated' : 'updated'} {tipOff(data.scores.updated_at)}
      </span>
      {data.stale && (
        <button type="button" className="lms-retry" onClick={data.refetch}>
          Retry
        </button>
      )}
    </p>
  )
}

/**
 * League → your matchup as one sheet that reads like a line score: the two teams and the category
 * score on top, then CatStrip pair (one column per category, the bar toward whoever leads), then the
 * Today lineup or, in the Week view, what follows the week (``weekExtras``). With ``mine`` false it
 * is someone else's matchup (the follower's Matchup of the week): week only, neutral bars.
 */
export function MatchupSheet({
  title,
  a,
  b,
  mine,
  week,
  view,
  canToday,
  onView,
  today,
  myId,
  weekExtras,
}: {
  title: string
  /** The first side: you, in your own matchup. */
  a: SheetSide
  b: SheetSide
  mine: boolean
  /** The week's category score, from a's side. */
  week: Record3
  view: 'today' | 'week'
  canToday: boolean
  onView: (v: 'today' | 'week') => void
  today: TodayData | null
  myId: number | null
  weekExtras?: ReactNode
}) {
  const line = today ? todayLine(today) : null
  const isToday = view === 'today'
  const short = { a: mine ? 'You' : shortTeam(a.name), b: shortTeam(b.name) }
  const dayRec = line?.rec ?? { wins: 0, losses: 0, ties: 0 }
  const weekRec = week
  const sub = (i: 0 | 1, s: SheetSide) => {
    if (isToday) {
      const n = line?.started ? line.toCome[i] : 0
      return n > 0 ? (
        <>
          <b className="num">{n}</b> to come today
        </>
      ) : null
    }
    return s.left != null && s.left > 0 ? (
      <>
        <b className="num">{s.left}</b> {s.left === 1 ? 'game' : 'games'} left
      </>
    ) : null
  }
  const said = isToday
    ? `Today ${dayRec.wins} won, ${dayRec.losses} lost, ${dayRec.ties} tied. Week ${recText(weekRec)}.`
    : `This week ${weekRec.wins} won, ${weekRec.losses} lost, ${weekRec.ties} tied${
        line?.started ? `. Today ${recText(dayRec)}` : ''
      }.`
  const style = {
    '--rival': b.colour ?? 'var(--accent)',
    '--home': a.colour ?? 'var(--accent)',
  } as CSSProperties

  return (
    <section className={`lms-sheet${mine ? ' mine' : ''}`} aria-labelledby="lms-title" style={style}>
      <div className="lms-head">
        <h2 id="lms-title" className="lms-title">
          {title}
        </h2>
        {today && line && (isToday || line.live) && <Status data={today} line={line} />}
        {canToday && <TodayWeekSwitch view={view} onPick={onView} />}
      </div>

      <div className="lsb-board" role="img" aria-label={`${mine ? 'You' : a.name} against ${b.name}. ${said}`}>
        <Side side={a} mine={mine} sub={sub(0, a)} />
        <div className="lsb-mid">
          {isToday ? <Score rec={dayRec} quiet={!line?.started} /> : <Score rec={weekRec} />}
          {isToday ? (
            <small>
              week <b className="num">{recText(weekRec)}</b>
            </small>
          ) : line?.started ? (
            <small>
              today <b className="num">{recText(dayRec)}</b>
            </small>
          ) : null}
        </div>
        <Side side={b} mine={false} sub={sub(1, b)} theirs />
      </div>

      <CatStripPair
        a={{ id: a.id, name: a.name, short: short.a, colour: a.colour, week: a.week, today: line?.figures[0] ?? null }}
        b={{ id: b.id, name: b.name, short: short.b, colour: b.colour, week: b.week, today: line?.figures[1] ?? null }}
        top={isToday ? 'today' : 'week'}
        sub={isToday ? 'week' : null}
        mine={mine ? 'a' : null}
        label={isToday ? "Today's categories, with the week so far" : "This week's categories"}
      />

      {isToday ? (
        today ? (
          <TodayMatchup
            data={today}
            me={{ id: a.id, name: a.name, colour: a.colour, week: a.week }}
            them={{ id: b.id, name: b.name, colour: b.colour, week: b.week }}
            myId={myId}
          />
        ) : (
          <TodayLoading />
        )
      ) : (
        weekExtras && <div className="lms-week">{weekExtras}</div>
      )}
    </section>
  )
}
