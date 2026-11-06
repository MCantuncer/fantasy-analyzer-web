import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowSquareOut,
  ArrowsInLineHorizontal,
  Broom,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ClockCounterClockwise,
  Couch,
  CrownSimple,
  FilmSlate,
  Fire,
  HandPalm,
  Info,
  ListNumbers,
  Medal,
  Trophy,
  UserPlus,
} from '@phosphor-icons/react'
import { ApiError, fetchRecap, type LeagueRef, type RecapFreeAgent, type RecapPlayer, type WeekRecap } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { STAT_COLUMNS, type StatColumn } from '../lib/statOrder'
import {
  CATS,
  afterLine,
  bestCats,
  bestTotal,
  catValue,
  dayName,
  games,
  gap,
  HAIR,
  markWeekSeen,
  nbaAbbrev,
  perGame,
  readRecap,
  shortName,
  sideResult,
  weekDates,
  type Matchup,
} from '../lib/filmRoom'
import { FilmShare } from './FilmShare'
import { PlayerLink } from './PlayerCard'
import { PlayerHead } from './PlayerHead'
import { ShotSplit } from './ShotSplit'
import { Bone } from './Skeleton'
import { TeamCrest } from './TeamCrest'
import './FilmRoom.css'

interface Team {
  id: number
  name: string
}

interface Props {
  leagueRef: LeagueRef
  creds: Credentials | null
  /** The league's teams, for names; colours come from the overview so crests match the rest of the site. */
  teams: Team[]
  colours: Map<number, string>
  myTeamId: number | null
  /** Week to open; null = the last finished week. */
  period: number | null
  onPeriod: (period: number) => void
  onBack: () => void
}

const MINE_ICON = (
  <svg className="fr-me" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0z" />
  </svg>
)

export function FilmRoom({ leagueRef, creds, teams, colours, myTeamId, period, onPeriod, onBack }: Props) {
  const recap = useQuery({
    queryKey: ['recap', leagueRef.leagueId, leagueRef.season, period, creds?.swid ?? null],
    queryFn: () => fetchRecap(leagueRef, period, creds),
    staleTime: 6 * 3600_000,
    retry: (n, e) => n < 1 && !(e instanceof ApiError && e.status < 500 && e.status > 0),
  })
  const r = recap.data
  const head = (
    <div className="fr-head">
      <button type="button" className="fr-back" onClick={onBack}>
        <CaretLeft size={15} aria-hidden="true" />
        League
      </button>
      {r && <WeekStepper recap={r} onPeriod={onPeriod} />}
    </div>
  )
  if (recap.isPending)
    return (
      <div className="fr stack" aria-busy="true">
        {head}
        <h1 className="fr-title">Film Room</h1>
        <p className="muted small">Pulling the tape: the first look at a week takes a few seconds.</p>
        <Bone h={220} className="fr-bone" />
        <Bone h={120} className="fr-bone" />
      </div>
    )
  if (recap.isError || !r)
    return (
      <div className="fr stack">
        {head}
        <h1 className="fr-title">Film Room</h1>
        <div className="card stack">
          <p>
            {recap.error instanceof ApiError && recap.error.code === 'week_not_finished'
              ? 'No tape yet: the first week is still being played. The Film Room opens once it is final.'
              : 'The tape did not load. Try again in a moment.'}
          </p>
          <div className="row">
            <button type="button" className="secondary" onClick={() => recap.refetch()}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  return (
    <FilmRoomPage recap={r} head={head} teams={teams} colours={colours} myTeamId={myTeamId} leagueRef={leagueRef} />
  )
}

function WeekStepper({ recap: r, onPeriod }: { recap: WeekRecap; onPeriod: (p: number) => void }) {
  const done = r.weeks.map((w) => w.period)
  const i = done.indexOf(r.period)
  const prev = i > 0 ? done[i - 1] : null
  const next = i >= 0 && i < done.length - 1 ? done[i + 1] : null
  return (
    <div className="fr-stepper" role="group" aria-label="Week">
      <button
        type="button"
        aria-label={prev ? `Week ${prev}` : 'No earlier week'}
        disabled={!prev}
        onClick={() => prev && onPeriod(prev)}
      >
        <CaretLeft size={16} aria-hidden="true" />
      </button>
      <span className="num">Week {r.period}</span>
      <button
        type="button"
        aria-label={next ? `Week ${next}` : 'The next week is still being played'}
        disabled={!next}
        onClick={() => next && onPeriod(next)}
      >
        <CaretRight size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function FilmRoomPage({
  recap: r,
  head,
  teams,
  colours,
  myTeamId,
  leagueRef,
}: {
  recap: WeekRecap
  head: ReactNode
  teams: Team[]
  colours: Map<number, string>
  myTeamId: number | null
  leagueRef: LeagueRef
}) {
  const d = useMemo(() => readRecap(r, myTeamId), [r, myTeamId])
  // Opening a week clears the "new tape" dot for it.
  useEffect(() => markWeekSeen(leagueRef.leagueId, leagueRef.season, r.period), [leagueRef.leagueId, leagueRef.season, r.period])
  const name = (id: number) =>
    teams.find((t) => t.id === id)?.name ?? r.teams.find((t) => t.team_id === id)?.name ?? 'Unknown team'
  const team = (id: number, size = 22) => (
    <span className="fr-tn">
      {id === myTeamId && MINE_ICON}
      <TeamCrest name={name(id)} colour={colours.get(id)} size={size} />
      <span className="fr-tn-name">
        {id === myTeamId && <span className="sr-only">Your team: </span>}
        {name(id)}
      </span>
    </span>
  )
  const espnAdd = `https://fantasy.espn.com/basketball/players/add?leagueId=${leagueRef.leagueId}`
  return (
    <div className="fr">
      {head}
      <header className="fr-ph">
        <h1 className="fr-title">Week {r.period} Film Room</h1>
        <p className="fr-sub">
          {weekDates(r)} · Final · {r.teams.length} teams
        </p>
      </header>
      <div className="fr-flow">
        {/* Phones read top to bottom in the order of the o-N classes; desktop splits into two columns. */}
        <div className="fr-col">
          <div className="fr-first o-1">
            {d.mine && myTeamId != null && <YourTape m={d.mine} myTeamId={myTeamId} team={team} />}
            <GameBalls recap={r} d={d} team={team} name={name} colours={colours} />
            {myTeamId != null && <FilmShare recap={r} d={d} name={name} colours={colours} leagueRef={leagueRef} />}
          </div>
          <div className="o-4">
            <BoxScoreTable recap={r} myTeamId={myTeamId} colours={colours} name={name} />
          </div>
          <div className="o-5">
            <FinalScores d={d} myTeamId={myTeamId} team={team} name={name} />
          </div>
        </div>
        <div className="fr-col">
          <div className="o-2">
            <MissedAssignments d={d} myTeamId={myTeamId} team={team} name={name} espnAdd={espnAdd} />
          </div>
          {myTeamId != null && (
            <div className="o-3">
              <YourWeekRest recap={r} d={d} myTeamId={myTeamId} name={name} />
            </div>
          )}
          <div className="o-6">
            <Awards recap={r} d={d} team={team} />
          </div>
        </div>
      </div>
    </div>
  )
}

type TeamFn = (id: number, size?: number) => ReactNode
type NameFn = (id: number) => string

function Face({ p, size }: { p: Pick<RecapPlayer, 'player_id' | 'name' | 'pro_team_id'>; size: number }) {
  return <PlayerHead player={{ id: p.player_id, name: p.name }} team={nbaAbbrev(p.pro_team_id)} size={size} />
}

function Name({ p, className }: { p: Pick<RecapPlayer, 'player_id' | 'name'>; className?: string }) {
  // The class sits on a wrapper: without the player card host the link renders as plain text.
  return (
    <span className={className}>
      <PlayerLink player={{ id: p.player_id, name: p.name }}>{p.name}</PlayerLink>
    </span>
  )
}

function YourTape({ m, myTeamId, team }: { m: Matchup; myTeamId: number; team: TeamFn }) {
  const me = m.sides.find((s) => s.team_id === myTeamId)!
  const them = m.sides.find((s) => s.team_id !== myTeamId)!
  const res = me.wins > them.wins ? 'W' : me.wins < them.wins ? 'L' : 'T'
  const order = res === 'L' ? [them, me] : [me, them]
  const hair = m.closest && m.closest.rel < HAIR ? m.closest : null
  return (
    <section className="card fr-tape" aria-labelledby="fr-tape-h">
      <div className="fr-tape-top">
        <h2 className="eyebrow" id="fr-tape-h">
          Your tape
        </h2>
        <span className={`fr-res ${res}`}>
          {res === 'W' ? 'Won' : res === 'L' ? 'Lost' : 'Tied'}{' '}
          <span className="num">
            {me.wins}–{me.losses}–{me.ties}
          </span>
        </span>
      </div>
      <div className="fr-board">
        {order.map((s, i) => (
          <div key={s.team_id} className={`fr-side ${i === 0 && res !== 'T' ? 'win' : 'lose'}`}>
            {team(s.team_id, 30)}
            <span className="fr-sc num">{s.wins}</span>
          </div>
        ))}
      </div>
      <ol className="fr-cats" aria-label="Your categories">
        {CATS.filter((c) => me.values[c] != null).map((c, i) => {
          const k = sideResult(me, them, c)
          return (
            <li
              key={c}
              className={`fr-cat ${k}${hair?.cat === c ? ' hair' : ''}`}
              style={{ '--i': i } as CSSProperties}
              aria-label={`${c} ${k === 'W' ? 'won' : k === 'L' ? 'lost' : 'tied'}, ${catValue(c, me.values[c])} to ${catValue(c, them.values[c])}`}
            >
              <span className="fr-cl">{c}</span>
              <span className="fr-cr">{k}</span>
            </li>
          )
        })}
      </ol>
      {hair && (
        <p className="fr-note">
          <ArrowsInLineHorizontal size={16} aria-hidden="true" />
          <span>
            <b>{hair.cat}</b> {m.decided ? 'decided it' : 'was the closest'}:{' '}
            <span className="num">{catValue(hair.cat, hair.winner.values[hair.cat])}</span> to{' '}
            <span className="num">{catValue(hair.cat, hair.loser.values[hair.cat])}</span>
            {hair.winner.team_id === myTeamId ? '' : ', theirs'}.
          </span>
        </p>
      )}
    </section>
  )
}

function GameBalls({
  recap: r,
  d,
  team,
  name,
  colours: map,
}: {
  recap: WeekRecap
  d: ReturnType<typeof readRecap>
  team: TeamFn
  name: NameFn
  colours: Map<number, string>
}) {
  const colours = (id: number) => map.get(id) ?? 'var(--muted)'
  const p = r.players[0]
  const tw = d.topWin
  const tp = d.topPickup
  return (
    <section aria-labelledby="fr-balls-h">
      <h2 className="sr-only" id="fr-balls-h">
        Game balls
      </h2>
      <ul className="fr-tiles">
        {p && (
          <li className="fr-tile">
            <span className="fr-tile-lab">Player</span>
            <span className="fr-tile-top">
              <Face p={p} size={34} />
              <span className="fr-tile-rk num">#1</span>
            </span>
            <Name p={p} className="fr-tile-name" />
            <span className="fr-tile-sub">
              <span className="num">{bestTotal(p)}</span>
              {p.owner_team_id != null ? team(p.owner_team_id, 16) : <span>Free agent</span>}
            </span>
          </li>
        )}
        {tw && (
          <li className="fr-tile" style={{ '--edge-c': colours(tw.sides[0].team_id) } as CSSProperties}>
            <span className="fr-tile-lab">Team</span>
            <span className="fr-tile-top">
              <TeamCrest name={name(tw.sides[0].team_id)} colour={colours(tw.sides[0].team_id)} size={34} />
              <span className="fr-tile-rk num">
                {tw.sides[0].wins}–{tw.sides[1].wins}
              </span>
            </span>
            <span className="fr-tile-name">{name(tw.sides[0].team_id)}</span>
            <span className="fr-tile-sub">
              <span>{tw.sides[0].wins === 9 || tw.sides[1].wins === 0 ? 'Swept' : 'Beat'}</span>
              {team(tw.sides[1].team_id, 16)}
            </span>
          </li>
        )}
        {tp && (
          <li className="fr-tile">
            <span className="fr-tile-lab">Pickup</span>
            <span className="fr-tile-top">
              <Face p={tp} size={34} />
              <span className="fr-tile-rk">{dayName(tp.weekday)}</span>
            </span>
            <Name p={tp} className="fr-tile-name" />
            <span className="fr-tile-sub">
              <span>
                <span className="num">{tp.after.games}</span> G for them
              </span>
              {team(tp.by, 16)}
            </span>
          </li>
        )}
      </ul>
    </section>
  )
}

function MissedAssignments({
  d,
  myTeamId,
  team,
  name,
  espnAdd,
}: {
  d: ReturnType<typeof readRecap>
  myTeamId: number | null
  team: TeamFn
  name: NameFn
  espnAdd: string
}) {
  const [panel, setPanel] = useState<'still' | 'taken'>('still')
  const [more, setMore] = useState(false)
  const star = d.freeNow[0]
  const rest = d.freeNow.slice(1)
  const SHOW = 2
  const dropped = (p: RecapFreeAgent) =>
    p.picked_up
      ? `${p.picked_up.team_id === myTeamId ? 'You' : name(p.picked_up.team_id)} added him ${dayName(p.picked_up.weekday)}, dropped since`
      : ''
  return (
    <section className="fr-sec" aria-labelledby="fr-fa-h">
      <div className="fr-sec-head">
        <h2 id="fr-fa-h">
          <UserPlus size={20} aria-hidden="true" />
          Missed assignments
        </h2>
        <span className="fr-sec-sub">Free agents who stood out</span>
      </div>
      <div className="fr-seg full" role="group" aria-label="Free agents">
        <button type="button" aria-pressed={panel === 'still'} onClick={() => setPanel('still')}>
          Still Free <span className="n num">{d.freeNow.length}</span>
        </button>
        <button type="button" aria-pressed={panel === 'taken'} onClick={() => setPanel('taken')}>
          Taken <span className="n num">{d.taken.length}</span>
        </button>
      </div>
      {panel === 'still' ? (
        <div className="fr-stack">
          {star ? (
            <article className="card fr-feat" style={{ '--tc': 'var(--track)' } as CSSProperties}>
              <div className="fr-feat-top">
                <Face p={star} size={56} />
                <div className="fr-min">
                  <Name p={star} className="fr-feat-name" />
                  <p className="fr-meta">
                    {nbaAbbrev(star.pro_team_id)} · {games(star.games)} ·{' '}
                    <span className="num">{perGame(star, 'minutes').toFixed(1)}</span> min
                  </p>
                </div>
                <span className="fr-rk">
                  <b className="num">#{star.rank}</b>
                  <small>of the week</small>
                </span>
              </div>
              <div className="fr-feat-stats">
                {bestCats(star, 3).map(({ cat, value }) => (
                  <div key={cat}>
                    <b className="num">{value}</b>
                    <span>
                      {cat}
                      {cat.endsWith('%') ? '' : ' a game'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="fr-honest">
                <Info size={16} aria-hidden="true" />
                <span>
                  <b>One week, {games(star.games)}.</b> {star.picked_up ? `${dropped(star)}. ` : 'Nobody added him. '}A hot
                  week is not a trend: check his minutes before you add.
                </span>
              </p>
              <div className="fr-feat-act">
                <a className="button" href={espnAdd} target="_blank" rel="noreferrer">
                  <ArrowSquareOut size={17} aria-hidden="true" />
                  Add on ESPN
                </a>
              </div>
            </article>
          ) : (
            <p className="fr-sec-sub">Every standout was added. Nobody is left on the wire.</p>
          )}
          {rest.length > 0 && (
            <div className="card fr-list-card">
              <ol className="fr-list">
                {rest.slice(0, more ? rest.length : SHOW).map((p) => (
                  <li key={p.player_id} className="fr-row with-act">
                    <Face p={p} size={40} />
                    <div className="fr-min">
                      <Name p={p} className="fr-row-n" />
                      <p className="fr-row-m">
                        {nbaAbbrev(p.pro_team_id)} · <span className="num">{p.games}</span> G ·{' '}
                        <span className="num">{perGame(p, 'minutes').toFixed(1)}</span> min
                      </p>
                      <p className={p.picked_up ? 'fr-row-m wrap' : 'fr-row-m'}>
                        {p.picked_up
                          ? dropped(p)
                          : bestCats(p, 2).map(({ cat, value }, i) => (
                              <span key={cat}>
                                {i > 0 && ' · '}
                                <b className="num">{value}</b> {cat}
                              </span>
                            ))}
                      </p>
                    </div>
                    <span className="fr-rk">
                      <b className="num">#{p.rank}</b>
                      <small>of the week</small>
                    </span>
                    <a
                      className="fr-icon-link"
                      href={espnAdd}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Add ${p.name} on ESPN (opens ESPN)`}
                    >
                      <ArrowSquareOut size={18} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
              {rest.length > SHOW && (
                <button type="button" className="fr-more" aria-expanded={more} onClick={() => setMore(!more)}>
                  {more ? 'Show less' : `Show ${rest.length - SHOW} more`}
                  {more ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card fr-list-card">
          {d.taken.length === 0 ? (
            <p className="fr-empty muted">Nobody grabbed a standout this week.</p>
          ) : (
            <ol className="fr-list">
              {d.taken.map((p) => {
                const pk = p.picked_up
                const by = pk ? pk.team_id : p.owner_now_team_id!
                const moved = pk && p.owner_now_team_id !== pk.team_id && p.owner_now_team_id != null
                return (
                  <li key={p.player_id} className={`fr-row${by === myTeamId ? ' mine' : ''}`}>
                    <Face p={p} size={40} />
                    <div className="fr-min">
                      <Name p={p} className="fr-row-n" />
                      <p className="fr-row-m fr-tl">
                        {team(by, 18)}
                        <span>· {pk ? dayName(pk.weekday) : 'after Sun'}</span>
                      </p>
                      <p className="fr-row-m wrap">
                        {pk ? afterLine(pk.after, by === myTeamId, true) : 'Free all week'}
                        {moved ? `. Now on ${name(p.owner_now_team_id!)}.` : ''}
                      </p>
                    </div>
                    <span className="fr-rk">
                      <b className="num">#{p.rank}</b>
                      <small>over the week</small>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

function YourWeekRest({
  recap: r,
  d,
  myTeamId,
  name,
}: {
  recap: WeekRecap
  d: ReturnType<typeof readRecap>
  myTeamId: number
  name: NameFn
}) {
  const mine = r.teams.find((t) => t.team_id === myTeamId)
  if (!mine) return null
  const { mvp, bench } = mine
  const adds = d.myAdds
  const miss = d.miss
  const lastName = (n: string) =>
    n
      .split(' ')
      .filter((w) => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w))
      .slice(-1)[0]
  return (
    <section className="card">
      <details className="fr-yours">
        <summary>
          <span>
            <span className="fr-sum-t">Your MVP, adds, miss and bench</span>
            <span className="fr-sum-l">
              {mvp ? (
                <>
                  {lastName(mvp.name)} <span className="num">#{mvp.rank}</span> ·{' '}
                </>
              ) : null}
              {adds.length ? `${adds.length} ${adds.length === 1 ? 'add' : 'adds'}` : 'no adds'} ·{' '}
              <span className="num">{bench.pts}</span> PTS on the bench
            </span>
          </span>
          <span className="fr-chev">
            <CaretDown size={16} aria-hidden="true" />
          </span>
        </summary>
        <div className="fr-yt">
          {mvp && (
            <div className="fr-yt-c">
              <div className="fr-yt-top">
                <span className="fr-yt-lab">
                  <CrownSimple size={15} aria-hidden="true" />
                  Your MVP
                </span>
                <span className="fr-yt-k num">#{mvp.rank}</span>
              </div>
              <div className="fr-yt-who">
                <Face p={mvp} size={34} />
                <Name p={mvp} className="fr-yt-name" />
              </div>
              <p className="fr-yt-sub">
                <b className="num">{perGame(mvp, 'pts').toFixed(1)}</b> PTS,{' '}
                <b className="num">{perGame(mvp, 'ast').toFixed(1)}</b> AST a game over {games(mvp.games)}
              </p>
            </div>
          )}
          <div className="fr-yt-c">
            <div className="fr-yt-top">
              <span className="fr-yt-lab">
                <UserPlus size={15} aria-hidden="true" />
                Your adds
              </span>
            </div>
            <div className="fr-adds">
              {adds.length ? (
                adds.map((a) => (
                  <div key={a.player_id} className="fr-add">
                    <Name p={a} className="fr-yt-name" />
                    <span className="fr-yt-sub">
                      Added {dayName(a.weekday)} · {afterLine(a.after, true)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="fr-yt-sub">No adds this week.</span>
              )}
            </div>
          </div>
          {miss?.picked_up && (
            <div className="fr-yt-c">
              <div className="fr-yt-top">
                <span className="fr-yt-lab">
                  <ClockCounterClockwise size={15} aria-hidden="true" />
                  Your miss
                </span>
                <span className="fr-yt-k num">#{miss.rank}</span>
              </div>
              <div className="fr-yt-who">
                <Face p={miss} size={34} />
                <Name p={miss} className="fr-yt-name" />
              </div>
              <p className="fr-yt-sub">
                Free till {dayName(miss.picked_up.weekday)}, then {name(miss.picked_up.team_id)} took him.{' '}
                {afterLine(miss.picked_up.after, false)}.
              </p>
            </div>
          )}
          <div className="fr-yt-c">
            <div className="fr-yt-top">
              <span className="fr-yt-lab">
                <Couch size={15} aria-hidden="true" />
                Your bench
              </span>
              <span className="fr-yt-k">
                <span className="num">{bench.games}</span> G
              </span>
            </div>
            <span className="fr-yt-big num">
              {bench.pts}
              <small>PTS</small>
            </span>
            <p className="fr-yt-sub">
              {bench.pts ? (
                <>
                  <span className="num">{bench.reb}</span> REB, <span className="num">{bench.ast}</span> AST left on the bench
                </>
              ) : (
                'Nothing left on the bench.'
              )}
            </p>
          </div>
        </div>
      </details>
    </section>
  )
}

// Columns in the site's one stat order; FG and FT show the made/attempted split instead of a total.
const TOTAL_OF: Record<StatColumn, keyof RecapPlayer['totals'] | null> = {
  MIN: 'minutes',
  FG: null,
  FT: null,
  PTS: 'pts',
  '3PM': 'tpm',
  REB: 'reb',
  AST: 'ast',
  STL: 'stl',
  BLK: 'blk',
  TO: 'to',
}
const LINE = STAT_COLUMNS.map((k) => [k, TOTAL_OF[k]] as const)

function BoxScoreTable({
  recap: r,
  myTeamId,
  colours,
  name,
}: {
  recap: WeekRecap
  myTeamId: number | null
  colours: Map<number, string>
  name: NameFn
}) {
  const [mode, setMode] = useState<'tot' | 'pg'>('tot')
  const [all, setAll] = useState(false)
  const shown = all ? r.players : r.players.slice(0, 5)
  return (
    <section className="fr-sec" aria-labelledby="fr-box-h">
      <div className="fr-sec-head">
        <h2 id="fr-box-h">
          <CrownSimple size={20} aria-hidden="true" />
          Box score
        </h2>
        <span className="fr-sec-sub">Players of the week</span>
      </div>
      <p className="fr-how">
        <Info size={14} aria-hidden="true" />
        <span>
          Ranked by 9-cat value over the week among every NBA player: the week's totals against the 200 busiest
          players, FG% and FT% weighted by attempts, TO counting against.
        </span>
      </p>
      <div className="card fr-tbl-card">
        <div className="fr-tbl-head">
          <p>Crest = owner</p>
          <span className="fr-seg" role="group" aria-label="Stat view">
            <button type="button" aria-pressed={mode === 'tot'} onClick={() => setMode('tot')}>
              Totals
            </button>
            <button type="button" aria-pressed={mode === 'pg'} onClick={() => setMode('pg')}>
              Per Game
            </button>
          </span>
        </div>
        <div className="fr-tbl-wrap">
          <table className="fr-stats">
            <thead>
              <tr>
                <th scope="col" className="fr-pl">
                  Player
                </th>
                {LINE.map(([k]) => (
                  <th key={k} scope="col">
                    {k}
                  </th>
                ))}
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const t = p.totals
                const v = (k: keyof RecapPlayer['totals']) =>
                  mode === 'tot' ? String(t[k]) : (t[k] / Math.max(1, p.games)).toFixed(1)
                return (
                  <tr key={p.player_id} className={p.owner_team_id === myTeamId ? 'mine' : ''}>
                    <th scope="row" className="fr-pl">
                      <span className="fr-pl-in">
                        <span className="fr-pl-rk num">{p.rank}</span>
                        <Face p={p} size={30} />
                        <span className="fr-pl-t">
                          <span className="fr-pl-n">
                            <PlayerLink player={{ id: p.player_id, name: p.name }}>{shortName(p.name)}</PlayerLink>
                          </span>
                          <span className="fr-pl-m">
                            {nbaAbbrev(p.pro_team_id)} · <span className="num">{p.games}</span> G ·{' '}
                            {p.owner_team_id == null ? (
                              <span className="fr-fa-mark">FA</span>
                            ) : (
                              <span className="fr-owner" title={name(p.owner_team_id)}>
                                {p.owner_team_id === myTeamId && MINE_ICON}
                                <TeamCrest name={name(p.owner_team_id)} colour={colours.get(p.owner_team_id)} size={15} />
                                <span className="sr-only">Owner: {name(p.owner_team_id)}</span>
                              </span>
                            )}
                          </span>
                        </span>
                      </span>
                    </th>
                    {LINE.map(([k, key]) =>
                      key ? (
                        <td key={k} className="num">
                          {v(key)}
                        </td>
                      ) : (
                        <td key={k}>
                          {mode === 'tot' ? (
                            <ShotSplit
                              made={k === 'FG' ? t.fgm : t.ftm}
                              attempts={k === 'FG' ? t.fga : t.fta}
                              label={k as 'FG' | 'FT'}
                            />
                          ) : (
                            <PerGameShot
                              made={k === 'FG' ? t.fgm : t.ftm}
                              attempts={k === 'FG' ? t.fga : t.fta}
                              games={p.games}
                            />
                          )}
                        </td>
                      ),
                    )}
                    <td className="fr-v num">{p.value.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {r.players.length > 5 && (
          <button type="button" className="fr-more" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Show top 5' : `Show all ${r.players.length}`}
            {all ? <CaretUp size={14} aria-hidden="true" /> : <CaretDown size={14} aria-hidden="true" />}
          </button>
        )}
      </div>
    </section>
  )
}

function PerGameShot({ made, attempts, games: g }: { made: number; attempts: number; games: number }) {
  const n = Math.max(1, g)
  return (
    <span className="shot-split">
      <span className="shot-split-ma num">
        {(made / n).toFixed(1)}/{(attempts / n).toFixed(1)}
      </span>
      <span className="shot-split-pct num">{attempts ? catValue('FG%', made / attempts) : '–'}</span>
    </span>
  )
}

function FinalScores({
  d,
  myTeamId,
  team,
  name,
}: {
  d: ReturnType<typeof readRecap>
  myTeamId: number | null
  team: TeamFn
  name: NameFn
}) {
  const sorted = [...d.matchups].sort((a, b) => b.margin - a.margin)
  return (
    <section className="fr-sec" aria-labelledby="fr-res-h">
      <div className="fr-sec-head">
        <h2 id="fr-res-h">
          <ListNumbers size={20} aria-hidden="true" />
          Final scores
        </h2>
        <span className="fr-sec-sub">
          {d.oneCat >= 2 ? (
            <>
              <span className="num">{d.oneCat}</span> of <span className="num">{d.matchups.length}</span> came down to
              one category
            </>
          ) : (
            `${d.matchups.length} matchups`
          )}
        </span>
      </div>
      <ol className="card fr-results">
        {sorted.map((m) => {
          const [w, l] = m.sides
          const isMine = w.team_id === myTeamId || l.team_id === myTeamId
          let tag: ReactNode = null
          if (m.winner && (w.wins === 9 || l.wins === 0) && m.margin >= 7)
            tag = (
              <>
                <Broom size={14} aria-hidden="true" />
                Sweep
              </>
            )
          else if (m.closest && m.closest.rel < HAIR)
            tag = (
              <>
                <ArrowsInLineHorizontal size={14} aria-hidden="true" />
                <span>
                  {m.closest.cat} by <span className="num">{gap(m.closest)}</span>
                  {m.closest.winner !== w ? `, to ${name(m.closest.winner.team_id)}` : ''}
                </span>
              </>
            )
          return (
            <li key={`${w.team_id}-${l.team_id}`} className={`fr-mu${isMine ? ' mine' : ''}`}>
              {tag && <span className="fr-mu-tag">{tag}</span>}
              {[w, l].map((s, i) => (
                <div key={s.team_id} className={`fr-mu-row${i === 0 && m.winner ? ' won' : ''}`}>
                  {team(s.team_id, 22)}
                  <span className="fr-sc num">{s.wins}</span>
                </div>
              ))}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Awards({ recap: r, d, team }: { recap: WeekRecap; d: ReturnType<typeof readRecap>; team: TeamFn }) {
  const sides = d.matchups.flatMap((m) => m.sides.map((s) => ({ s, m })))
  const bench = [...r.teams].sort((a, b) => b.bench.pts - a.bench.pts)[0]
  const pts = [...sides].sort((a, b) => (b.s.values.PTS ?? 0) - (a.s.values.PTS ?? 0))
  const top = pts[0]
  const lost = top && top.m.winner && top.m.winner !== top.s
  const blk = [...sides].sort((a, b) => (b.s.values.BLK ?? 0) - (a.s.values.BLK ?? 0))
  const mvps = r.teams.filter((t) => t.mvp).sort((a, b) => a.mvp!.rank - b.mvp!.rank)
  const row = (icon: ReactNode, title: string, who: ReactNode, value: number, unit: string, note?: ReactNode) => (
    <li className="fr-aw" key={title}>
      {icon}
      <div className="fr-min">
        <p className="fr-aw-t">{title}</p>
        <p className="fr-aw-w">
          {who}
          {note && <span>· {note}</span>}
        </p>
      </div>
      <span className="fr-aw-v">
        <b className="num">{Math.round(value)}</b>
        <small>{unit}</small>
      </span>
    </li>
  )
  return (
    <section className="fr-sec" aria-labelledby="fr-aw-h">
      <div className="fr-sec-head">
        <h2 id="fr-aw-h">
          <Trophy size={20} aria-hidden="true" />
          Awards
        </h2>
      </div>
      <div className="card fr-aw-card">
        <ol>
          {bench && bench.bench.pts > 0 &&
            row(
              <Couch size={20} aria-hidden="true" />,
              'Pine time',
              team(bench.team_id, 18),
              bench.bench.pts,
              `PTS benched, ${bench.bench.games} G`,
            )}
          {top &&
            row(
              <Fire size={20} aria-hidden="true" />,
              lost ? 'Most points, still lost' : 'Most points',
              team(top.s.team_id, 18),
              top.s.values.PTS ?? 0,
              'PTS',
              lost ? `lost ${top.s.wins}–${top.s.losses}` : undefined,
            )}
          {blk.length > 1 &&
            row(
              <HandPalm size={20} aria-hidden="true" />,
              'Block party',
              team(blk[0].s.team_id, 18),
              blk[0].s.values.BLK ?? 0,
              'BLK',
              <>
                next best <span className="num">{Math.round(blk[1].s.values.BLK ?? 0)}</span>
              </>,
            )}
        </ol>
        {mvps.length > 0 && (
          <details className="fr-mvps">
            <summary>
              <span className="fr-mvps-t">
                <Medal size={17} aria-hidden="true" />
                Game balls
              </span>
              <span className="muted">
                Each team's MVP <CaretDown size={13} aria-hidden="true" />
              </span>
            </summary>
            <ol>
              {mvps.map((t) => (
                <li key={t.team_id} className="fr-mvp">
                  <span className="fr-mvp-p">
                    <Face p={t.mvp!} size={34} />
                    <span>
                      <Name p={t.mvp!} className="fr-mvp-n" />
                      <span className="fr-mvp-t">{team(t.team_id, 15)}</span>
                    </span>
                  </span>
                  <span className="fr-mvp-rk num">#{t.mvp!.rank}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  )
}

/** The League tab's "Week N Film Room is in" card, shown Monday to Wednesday after a week ends. */
export function FilmRoomEntry({
  leagueRef,
  creds,
  period,
  myTeamId,
  unseen = false,
  onOpen,
}: {
  leagueRef: LeagueRef
  creds: Credentials | null
  /** The week that just ended. */
  period: number
  myTeamId: number | null
  unseen?: boolean
  onOpen: () => void
}) {
  // Same key as the page, so the tape is ready by the time it opens.
  const recap = useQuery({
    queryKey: ['recap', leagueRef.leagueId, leagueRef.season, null, creds?.swid ?? null],
    queryFn: () => fetchRecap(leagueRef, null, creds),
    staleTime: 6 * 3600_000,
    retry: false,
  })
  const r = recap.data
  if (recap.isError || (r && r.period !== period)) return null
  const d = r ? readRecap(r, myTeamId) : null
  const faces = r ? [r.players[1], r.players[2], r.players[0]].filter(Boolean) : []
  const me = d?.mine?.sides.find((s) => s.team_id === myTeamId)
  const them = d?.mine?.sides.find((s) => s.team_id !== myTeamId)
  return (
    <button type="button" className="fr-drop" onClick={onOpen}>
      <span className="fr-fan" aria-hidden="true">
        {faces.length === 3 ? (
          faces.map((p, i) => <Face key={p.player_id} p={p} size={i === 2 ? 52 : 40} />)
        ) : (
          <Trophy size={40} />
        )}
      </span>
      <span className="fr-drop-t">
        <span className="fr-drop-h">
          Week {period} Film Room is{' '}
          <span className="fr-nowrap">
            in
            {unseen && (
              <span className="fr-dot">
                <span className="sr-only">, not opened yet</span>
              </span>
            )}
          </span>
        </span>
        <span className="fr-drop-l">
          {r ? (
            <>
              {me && them ? (
                <>
                  You {me.wins > them.wins ? 'won' : me.wins < them.wins ? 'lost' : 'tied'}{' '}
                  <span className="num">
                    {me.wins}–{them.wins}
                  </span>
                  .{' '}
                </>
              ) : null}
              {r.players[0] ? `${r.players[0].name} was the player of the week.` : ''}
            </>
          ) : (
            'Game balls, missed assignments and every final score.'
          )}
        </span>
      </span>
      <CaretRight size={18} className="fr-drop-go" aria-hidden="true" />
    </button>
  )
}

/** "Film Room" button on the League tab: a menu of every finished week. */
export function FilmRoomPicker({
  weeks,
  unseen = false,
  onPick,
}: {
  weeks: number[]
  /** The latest finished week hasn't been opened here yet: a gold dot on the button and that week. */
  unseen?: boolean
  onPick: (period: number) => void
}) {
  const [open, setOpen] = useState(false)
  if (!weeks.length) return null
  return (
    <div
      className="fr-pick"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className="fr-pick-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <FilmSlate size={17} aria-hidden="true" />
        Film Room
        {unseen && (
          <span className="fr-dot">
            <span className="sr-only">, new week in</span>
          </span>
        )}
        <CaretDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="fr-menu" role="group" aria-label="Finished weeks">
          {[...weeks].reverse().map((w, i) => (
            <button
              type="button"
              key={w}
              onClick={() => {
                setOpen(false)
                onPick(w)
              }}
            >
              <FilmSlate size={16} aria-hidden="true" />
              <span>
                <span className="fr-m1">Week {w}</span>
                <span className="fr-m2">
                  {i === 0 ? 'Last week' : `${i + 1} weeks ago`}
                  {i === 0 && unseen ? ' · new' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
