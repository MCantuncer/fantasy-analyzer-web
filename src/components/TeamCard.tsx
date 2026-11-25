import { CaretDown, CaretLeft, CaretRight, TrendDown, TrendUp } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, UIEvent } from 'react'
import { createPortal } from 'react-dom'
import { fetchPlayerIndex, type IndexedPlayer, type LeagueRef, type TeamResult } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { useEscapeLayer } from '../lib/escapeStack'
import { useSwipeToClose } from '../lib/swipeToClose'
import { teamColours, teamLogoUrl } from '../lib/league'
import { teamColour } from '../lib/nbaTeams'
import { usePlayerCard, usePlayerCardShown } from '../lib/playerCard'
import { ownerKind } from '../lib/playerSearch'
import { closeTeamCard, teamQuery, useTeamCardOpen } from '../lib/teamCard'
import { streakText, teamComment } from '../lib/teamComment'
import { teamByAbbrev, teamName } from '../lib/teamSearch'
import { PlayerHead, TeamLogo } from './PlayerHead'
import { InjuryTag, Owner, type Owners } from './PlayerSearch'
import './TeamCard.css'

interface HostProps {
  leagueRef: LeagueRef | null
  creds: Credentials | null
  teams: { id: number; name: string }[]
  myTeamId: number | null
}

/** Mounted once by App: the NBA team card the header search opens. */
export function TeamCardHost({ leagueRef, creds, teams, myTeamId }: HostProps) {
  const abbrev = useTeamCardOpen()
  const leagueKey = leagueRef ? `${leagueRef.leagueId}:${leagueRef.season}` : null
  const last = useRef(leagueKey)
  useEffect(() => {
    if (last.current !== leagueKey) closeTeamCard() // another league's team card never stays open
    last.current = leagueKey
  }, [leagueKey])
  if (!abbrev || !leagueRef || !teamByAbbrev(abbrev)) return null
  return (
    <TeamSheet
      key={`${leagueKey}:${abbrev}`}
      abbrev={abbrev}
      leagueRef={leagueRef}
      creds={creds}
      teams={teams}
      myTeamId={myTeamId}
    />
  )
}

type RosterFilter = 'all' | 'free' | 'yours'

const FILTERS: { id: RosterFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'free', label: 'Free Agents' },
  { id: 'yours', label: 'Yours' },
]

/** Free agents rostered in under 1% of ESPN leagues fold into one "Deep bench" line. */
const DEEP = 1

function TeamSheet({
  abbrev,
  leagueRef,
  creds,
  teams,
  myTeamId,
}: HostProps & { abbrev: string; leagueRef: LeagueRef }) {
  const titleId = useId()
  const team = teamByAbbrev(abbrev)!
  const name = teamName(team)
  const dialog = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const hero = useRef<HTMLElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const card = usePlayerCard()
  const under = usePlayerCardShown()
  const [folded, setFolded] = useState(false)
  const [filter, setFilter] = useState<RosterFilter>('all')
  const [deep, setDeep] = useState(false)

  const info = useQuery(teamQuery(leagueRef, abbrev, creds))
  const index = useQuery({
    queryKey: ['player-index', leagueRef.leagueId, leagueRef.season],
    queryFn: () => fetchPlayerIndex(leagueRef, creds),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    const body = document.body.style
    const before = body.overflow
    body.overflow = 'hidden'
    return () => {
      body.overflow = before
    }
  }, [])
  useEscapeLayer(true, closeTeamCard)
  // A player card on top takes the swipe; the team card waits underneath.
  useSwipeToClose(dialog, closeTeamCard, { backdrop, enabled: !under })

  const owners: Owners = useMemo(
    () => ({
      myTeamId,
      names: new Map(teams.map((t) => [t.id, t.name])),
      colours: teamColours(
        teams.map((t) => t.id),
        myTeamId,
      ),
    }),
    [teams, myTeamId],
  )
  const roster = useMemo(
    () =>
      (index.data?.players ?? [])
        // ESPN keeps long-gone players on their old team: only today's roster.
        .filter((p) => p.pro_team === abbrev && p.on_roster !== false)
        .sort((a, b) => b.percent_owned - a.percent_owned || a.name.localeCompare(b.name)),
    [index.data, abbrev],
  )
  const counts = useMemo(() => {
    const c: Record<RosterFilter, number> = { all: roster.length, free: 0, yours: 0 }
    for (const p of roster) {
      const k = ownerKind(p, myTeamId)
      if (k === 'free' || k === 'yours') c[k]++
    }
    return c
  }, [roster, myTeamId])
  const filters = FILTERS.filter((f) => f.id !== 'yours' || counts.yours > 0)
  const shown = filter === 'all' ? roster : roster.filter((p) => ownerKind(p, myTeamId) === filter)
  const isDeep = (p: IndexedPlayer) => p.owner_team_id == null && p.percent_owned < DEEP
  // The deep bench folds only under All: a filter shows every player its count says.
  const top = filter !== 'all' || deep ? shown : shown.filter((p) => !isDeep(p))
  const folds = shown.length - top.length

  const data = info.data
  const comment = useMemo(
    () =>
      data
        ? teamComment(
            data.latest,
            roster.map((p) => p.name),
          )
        : null,
    [data, roster],
  )
  const streak = streakText(data?.streak)
  const record = data ? `${data.wins}–${data.losses}` : null
  const colour = teamColour(abbrev)
  const style = colour ? ({ '--pc-team': colour } as CSSProperties) : undefined

  // The hero folds into a 56px bar once it scrolls away.
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const h = hero.current?.offsetHeight ?? 120
    const next = e.currentTarget.scrollTop > h - 56
    if (next !== folded) setFolded(next)
  }

  // Keep Tab inside the card while it is open.
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return
    const items = [
      ...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'),
    ].filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const lastItem = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      lastItem.focus()
    } else if (!e.shiftKey && document.activeElement === lastItem) {
      e.preventDefault()
      first.focus()
    }
  }

  const segs = (where: string) => (
    <div className={`tc-segs tc-segs-${where}`} role="group" aria-label="Who has them">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          className="tc-seg"
          aria-pressed={filter === f.id}
          onClick={() => setFilter(f.id)}
        >
          {f.label}
          <span className="tc-n tnum">{counts[f.id]}</span>
        </button>
      ))}
    </div>
  )

  const close = (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )

  return createPortal(
    <div className="tc-layer" inert={under}>
      <div ref={backdrop} className="tc-backdrop" onClick={closeTeamCard} aria-hidden="true" />
      <div
        ref={dialog}
        className={['tc-sheet', under && 'tc-under', folded && 'tc-folded'].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trap}
        style={style}
      >
        <div className="tc-bar" aria-hidden="true">
          <span className="tc-bar-logo">
            <TeamLogo abbrev={abbrev} size={22} fallback />
          </span>
          <span className="tc-bar-name">{name}</span>
          {record && <span className="tc-bar-rec tnum">{record}</span>}
          <button
            type="button"
            className="tc-bar-close"
            tabIndex={-1}
            aria-label="Close team card"
            onClick={closeTeamCard}
          >
            {close}
          </button>
        </div>
        <div className="tc-scroll" onScroll={onScroll}>
          <header ref={hero} className={colour ? 'pc-hero pc-hero-team tc-hero' : 'pc-hero tc-hero'} style={style}>
            <div className="pc-grab" aria-hidden="true" />
            <Watermark abbrev={abbrev} />
            <span className="tc-logo">
              <TeamLogo abbrev={abbrev} size={52} fallback />
            </span>
            <div className="tc-who">
              <span className="pc-eyebrow">NBA · {abbrev}</span>
              <h2 id={titleId} ref={heading} className="pc-name tc-name" tabIndex={-1}>
                {name}
              </h2>
            </div>
            <div className="tc-record">
              {record ? (
                <span className="tc-wl tnum" aria-label={`Record ${data!.wins} wins, ${data!.losses} losses`}>
                  {record}
                </span>
              ) : (
                <span className="tc-wl tc-wl-wait" aria-hidden="true" />
              )}
              {streak && (
                <span className="tc-streak">
                  {data!.streak!.startsWith('W') ? (
                    <TrendUp size={14} weight="bold" aria-hidden="true" />
                  ) : (
                    <TrendDown size={14} weight="bold" aria-hidden="true" />
                  )}
                  {streak}
                </span>
              )}
            </div>
            <button type="button" className="pc-close" aria-label="Close team card" onClick={closeTeamCard}>
              {close}
            </button>
          </header>

          <section className="tc-section" aria-labelledby={`${titleId}-last`}>
            <div className="tc-head">
              <h3 id={`${titleId}-last`} className="tc-title">
                Last 5
              </h3>
              <span className="tc-aside" aria-hidden="true">
                oldest → latest
              </span>
            </div>
            {info.isError ? (
              <div className="tc-error">
                <p>Couldn&apos;t load their games.</p>
                <button type="button" className="secondary" onClick={() => void info.refetch()}>
                  Try again
                </button>
              </div>
            ) : data && !data.latest.length ? (
              <p className="tc-quiet">No games yet this season.</p>
            ) : (
              <>
                <ol className="tc-plates">
                  {data
                    ? [...data.latest].reverse().map((g) => <Plate key={g.game_id} game={g} />)
                    : [0, 1, 2, 3, 4].map((i) => <li key={i} className="tc-plate tc-plate-wait" aria-hidden="true" />)}
                </ol>
                {comment && <p className="tc-comment">{comment}</p>}
              </>
            )}
          </section>

          <section className="tc-section tc-roster" aria-labelledby={`${titleId}-roster`}>
            <div className="tc-head tc-roster-head">
              <h3 id={`${titleId}-roster`} className="tc-title">
                Roster {roster.length > 0 && <span className="tc-count tnum">{roster.length}</span>}
              </h3>
              {roster.length > 0 && segs('top')}
            </div>
            {roster.length > 0 && (
              <div className="tc-cols" aria-hidden="true">
                <span>Player, most rostered first</span>
                <span>In your league</span>
                <span>ESPN rostered</span>
              </div>
            )}
            {index.isPending && <p className="tc-quiet">Loading the roster…</p>}
            {index.isError && (
              <div className="tc-error">
                <p>Couldn&apos;t load the roster.</p>
                <button type="button" className="secondary" onClick={() => void index.refetch()}>
                  Try again
                </button>
              </div>
            )}
            <ul className="tc-list">
              {top.map((p) => (
                <li key={p.player_id}>
                  <button
                    type="button"
                    className="tc-row"
                    aria-label={rowLabel(p, owners)}
                    onClick={() => card?.open({ id: p.player_id, name: p.name })}
                    onMouseEnter={() => card?.prefetch({ id: p.player_id, name: p.name })}
                    onPointerDown={() => card?.prefetch({ id: p.player_id, name: p.name })}
                  >
                    <PlayerHead player={{ id: p.player_id, name: p.name }} size={40} />
                    <span className="tc-nm">{p.name}</span>
                    <span className="tc-meta">
                      {p.position}
                      <InjuryTag status={p.injury_status} />
                      <span className="tc-meta-own">
                        <Owner p={p} owners={owners} />
                      </span>
                    </span>
                    <span className="tc-own">
                      <Owner p={p} owners={owners} />
                    </span>
                    <span className="tc-ros tnum">
                      {p.percent_owned >= 10 || p.percent_owned === 0 ? Math.round(p.percent_owned) : p.percent_owned}
                      <small>%</small>
                    </span>
                    <CaretRight className="tc-go" size={16} weight="bold" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {folds > 0 && (
              <button type="button" className="tc-deep" onClick={() => setDeep(true)}>
                <CaretDown size={14} weight="bold" aria-hidden="true" />
                <span className="tc-deep-lbl">Deep bench</span>
                <span className="tc-deep-n">
                  {folds} more, under {DEEP}% rostered
                </span>
              </button>
            )}
            {filter !== 'all' && shown.length === 0 && roster.length > 0 && (
              <p className="tc-quiet">No one in this filter.</p>
            )}
          </section>
        </div>
        <div className="tc-dock">
          <button type="button" className="tc-back" aria-label="Back to results" onClick={closeTeamCard}>
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>
          {roster.length > 0 && segs('dock')}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function rowLabel(p: IndexedPlayer, owners: Owners): string {
  const kind = ownerKind(p, owners.myTeamId)
  const owner =
    kind === 'yours'
      ? 'on your team'
      : kind === 'free'
        ? 'free agent'
        : `on ${owners.names.get(p.owner_team_id!) ?? `team ${p.owner_team_id}`}`
  const hurt = p.injury_status ? p.injury_status.replace(/_/g, ' ').toLowerCase() : ''
  return [p.name, p.position, hurt, owner, `${Math.round(p.percent_owned)}% rostered`].filter(Boolean).join(', ')
}

function Watermark({ abbrev }: { abbrev: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      className="pc-watermark"
      src={teamLogoUrl(abbrev)}
      alt=""
      aria-hidden="true"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}

function gameDay(g: TeamResult): string {
  const iso = g.date ? `${g.date}T12:00:00Z` : g.start
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** One game of the last five: a win sits a step above the rail and a loss a step below, so the run
 * reads without colour; the letter says it too. */
function Plate({ game: g }: { game: TeamResult }) {
  const by = g.points - g.opponent_points
  const day = gameDay(g)
  const opp = teamByAbbrev(g.opponent)
  const said = `${day}, ${g.won ? 'won' : 'lost'} ${g.points} to ${g.opponent_points} ${g.home ? 'against' : 'at'} ${
    opp ? teamName(opp) : g.opponent_name
  }${g.top ? `, ${g.top.name} ${g.top.pts} points` : ''}`
  return (
    <li
      className={`tc-plate ${g.won ? 'tc-w' : 'tc-l'}`}
      aria-label={said}
      title={g.top ? `${g.top.name} ${g.top.pts} pts` : undefined}
    >
      <span className="tc-opp" aria-hidden="true">
        <span className="tc-at">{g.home ? 'vs' : '@'}</span>
        <TeamLogo abbrev={g.opponent} size={16} />
        <span>{g.opponent}</span>
      </span>
      <span className="tc-res" aria-hidden="true">
        <b className="tc-letter">{g.won ? 'W' : 'L'}</b>
        <span className="tc-by tnum">{by > 0 ? `+${by}` : `−${-by}`}</span>
      </span>
      <span className="tc-score tnum" aria-hidden="true">
        {g.points}-{g.opponent_points}
      </span>
      <span className="tc-day" aria-hidden="true">
        {day}
      </span>
    </li>
  )
}
