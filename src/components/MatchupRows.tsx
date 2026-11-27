import { useEffect, useRef, useState } from 'react'
import { CaretDown, X } from '@phosphor-icons/react'
import type { LeagueRef, MatchupSide, OverviewMatchup } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { useEscapeLayer } from '../lib/escapeStack'
import { todayLine, withinOne } from '../lib/matchupSheet'
import { todayMatters, useTodayMatchup } from '../lib/todayData'
import { CatStripPair } from './CatStrip'
import { TodayWeekSwitch } from './MatchupSheet'
import { TodayLoading, TodayMatchup } from './TodayMatchup'
import { TeamCrest } from './TeamCrest'
import { YouTag } from './YouTag'
import './MatchupRows.css'

const key = (m: OverviewMatchup) => `${m.home.team_id}-${m.away.team_id}`

interface Props {
  matchups: OverviewMatchup[]
  /** The two sides of a matchup, you (or the matchup of the week's star) first. */
  sides: (m: OverviewMatchup) => [MatchupSide, MatchupSide]
  nameOf: (id: number) => string
  colours: Map<number, string>
  myTeamId: number | null
  mine: OverviewMatchup | undefined
  week: { start: string | null | undefined; end: string | null | undefined }
  leagueRef?: LeagueRef
  creds: Credentials | null
}

/**
 * League → the week's matchups as mirrored rows: crest · name · score – score · name · crest, the
 * leader in ink. A short marker line says what's worth knowing (ties, within one).
 * A row with a box score opens it in place, right under itself: CatStrip pair for the week, or today's
 * strip and both lineups. Esc closes it.
 */
export function MatchupRows({ matchups, sides, nameOf, colours, myTeamId, mine, week, leagueRef, creds }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const focusBox = useRef(false)
  const rows = useRef(new Map<string, HTMLButtonElement>())
  const box = useRef<HTMLDivElement>(null)
  const hasBox = (m: OverviewMatchup) => (m.home.categories?.length ?? 0) > 0
  const openMatchup = matchups.find((m) => key(m) === open && hasBox(m))
  const pair = openMatchup ? sides(openMatchup) : null

  useEffect(() => {
    if (open != null && !openMatchup) setOpen(null)
  }, [open, openMatchup])
  useEffect(() => {
    if (openMatchup && focusBox.current) box.current?.focus({ preventScroll: true })
    focusBox.current = false
  }, [openMatchup])

  const close = () => {
    if (!open) return
    const row = rows.current.get(open)
    setOpen(null)
    row?.focus({ preventScroll: true })
  }
  // Esc closes from anywhere on the page, once whatever opened on top of it (a player card) is closed.
  useEscapeLayer(!!openMatchup, close)

  const today = useTodayMatchup(
    leagueRef?.leagueId,
    leagueRef?.season,
    creds,
    myTeamId,
    pair ? [pair[0].team_id, pair[1].team_id] : null,
    week.start,
    week.end,
  )
  const [pick, setPick] = useState<{ key: string; view: 'today' | 'week' } | null>(null)
  const canToday = !!pair && !!leagueRef && today.inWeek !== false && !today.failed && (!!today.data || today.loading)
  const view: 'today' | 'week' = !canToday
    ? 'week'
    : pick && pick.key === open
      ? pick.view
      : today.data && !todayMatters(today.data)
        ? 'week'
        : 'today'

  const panel = () => {
    if (!openMatchup || !pair) return null
    const [a, b] = pair
    const meIn = a.team_id === myTeamId
    const line = view === 'today' && today.data ? todayLine(today.data) : null
    const side = (s: MatchupSide, i: 0 | 1) => ({
      id: s.team_id,
      name: nameOf(s.team_id),
      short: meIn && i === 0 ? 'You' : nameOf(s.team_id),
      colour: colours.get(s.team_id),
      week: s.categories ?? [],
      today: line?.figures[i] ?? null,
    })
    const title = `${nameOf(a.team_id)} vs ${nameOf(b.team_id)}`
    return (
      <div
        ref={box}
        id={`lmr-box-${key(openMatchup)}`}
        className="lmr-box"
        role="region"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="lmr-box-head">
          {canToday && <TodayWeekSwitch view={view} onPick={(v) => setPick({ key: open!, view: v })} />}
          <button type="button" className="lmr-close" aria-label="Close matchup" onClick={close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <CatStripPair
          a={side(a, 0)}
          b={side(b, 1)}
          top={view}
          sub={view === 'today' ? 'week' : null}
          mine={meIn ? 'a' : null}
          keyed="crest"
          label={view === 'today' ? `${title}, today, with the week so far` : `${title}, this week`}
        />
        {view === 'today' &&
          (today.data ? (
            <TodayMatchup
              data={today.data}
              me={{ id: a.team_id, name: nameOf(a.team_id), colour: colours.get(a.team_id), week: a.categories ?? [] }}
              them={{
                id: b.team_id,
                name: nameOf(b.team_id),
                colour: colours.get(b.team_id),
                week: b.categories ?? [],
              }}
              myId={myTeamId}
            />
          ) : (
            <TodayLoading />
          ))}
      </div>
    )
  }

  return (
    <ol className="lmr-rows">
      {matchups.map((m) => {
        const [a, b] = sides(m)
        const k = key(m)
        const isMine = m === mine
        const close1 = withinOne(a, b)
        const marks = [
          a.ties > 0 ? <span key="tied">{a.ties} tied</span> : null,
          close1 ? (
            <span key="close" className="lmr-close-mark">
              Within one
            </span>
          ) : null,
        ].filter(Boolean)
        const lead = a.wins > b.wins ? 'a' : b.wins > a.wins ? 'b' : null
        const team = (s: MatchupSide, at: 'a' | 'b') => (
          <span className={`lmr-side lmr-${at}${lead === at ? ' lmr-lead' : ''}`}>
            <TeamCrest name={nameOf(s.team_id)} colour={colours.get(s.team_id)} size={22} />
            <span className="lmr-who">
              <span className="lmr-nm">{nameOf(s.team_id)}</span>
              {s.team_id === myTeamId && <YouTag />}
            </span>
            <span className="lmr-sc num">{s.wins}</span>
          </span>
        )
        const body = (
          <>
            {team(a, 'a')}
            <span className="lmr-dash" aria-hidden="true">
              –
            </span>
            {team(b, 'b')}
            {marks.length > 0 && <span className="lmr-marks">{marks}</span>}
          </>
        )
        const isOpen = k === open && !!openMatchup
        const said = [
          `${isMine ? 'Your matchup: ' : ''}${nameOf(a.team_id)} ${a.wins}, ${nameOf(b.team_id)} ${b.wins}`,
          a.ties > 0 ? `${a.ties} tied` : '',
          close1 ? 'within one' : '',
        ]
          .filter(Boolean)
          .join(', ')
        return (
          <li key={k} className={`lmr-item${isMine ? ' mine' : ''}${isOpen ? ' open' : ''}`}>
            {hasBox(m) ? (
              <button
                type="button"
                ref={(el) => {
                  if (el) rows.current.set(k, el)
                  else rows.current.delete(k)
                }}
                className="lmr-row"
                aria-expanded={isOpen}
                aria-controls={isOpen ? `lmr-box-${k}` : undefined}
                aria-label={said}
                onClick={(e) => {
                  if (isOpen) return close()
                  focusBox.current = e.detail === 0
                  setOpen(k)
                }}
              >
                {body}
                <CaretDown className="lmr-caret" size={16} aria-hidden="true" />
              </button>
            ) : (
              <div className="lmr-row">{body}</div>
            )}
            {isOpen && panel()}
          </li>
        )
      })}
    </ol>
  )
}
