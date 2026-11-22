import { Equals, Flame, GlobeSimple, MapPin, Snowflake } from '@phosphor-icons/react'
import { useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  HEAT_RULE,
  HEAT_WORDS,
  formRead,
  inVenue,
  marginOf,
  nick,
  shortDate,
  signedMargin,
  verdictReason,
} from '../../lib/matchForm'
import type { FormHeat, FormRead, MatchForm, Side, TeamForm } from '../../lib/matchForm'
import { teamLight } from '../../lib/nbaTeams'
import { TeamLogo } from '../PlayerHead'
import { BoxScores } from './BoxScores'
import './FormView.css'

/** The match card's Form view (Can 2026-11-22, "Scouting Report"): who is heating up or cooling off
 *  before they meet, read from both teams' games this season, all of them or tonight's venue only. */

const HEAT_ICON = { hot: Flame, cold: Snowflake, steady: Equals } as const

export function HeatIcon({ heat, size = 17 }: { heat: FormHeat; size?: number }) {
  const Icon = HEAT_ICON[heat]
  return <Icon size={size} weight={heat === 'steady' ? 'bold' : 'fill'} aria-hidden="true" />
}

export function FormView({
  form,
  venueNeutral,
  initialSide = 'away',
}: {
  form: MatchForm
  venueNeutral: boolean
  /** The side the list opens on: the side a Kupon pick backs. */
  initialSide?: Side
}) {
  const [venue, setVenue] = useState(false)
  const [side, setSide] = useState<Side>(initialSide)
  const on = venue && !venueNeutral
  const shown = useMemo(
    () => ({ away: inVenue(form.away.games, 'away', on), home: inVenue(form.home.games, 'home', on) }),
    [form, on],
  )
  return (
    <div className="mf">
      <section className="mf-read" aria-label="Who is in form">
        <div className="mf-verdicts">
          <Verdict team={form.away} side="away" venue={on} />
          <Verdict team={form.home} side="home" venue={on} />
        </div>
        <VenueSwitch
          on={on}
          neutral={venueNeutral}
          away={form.away.abbrev}
          home={form.home.abbrev}
          onChange={setVenue}
        />
      </section>
      <BoxScores away={form.away} home={form.home} side={side} onSide={setSide} shown={shown} venue={on} />
      <p className="mf-rule">{HEAT_RULE}</p>
    </div>
  )
}

function Verdict({ team, side, venue }: { team: TeamForm; side: Side; venue: boolean }) {
  const shown = inVenue(team.games, side, venue)
  const read = formRead(shown)
  const where = venue ? (side === 'home' ? 'at home' : 'on the road') : ''
  const name = nick(team.abbrev)
  return (
    <div className="mf-vd" style={{ '--tl': teamLight(team.abbrev) ?? 'var(--border)' } as CSSProperties}>
      <span className="mf-vd-logo" aria-hidden="true">
        <TeamLogo abbrev={team.abbrev} size={34} fallback />
      </span>
      <p className="mf-vd-line">
        <b>{name}</b>{' '}
        <span className={`mf-st ${read.heat}`}>
          <HeatIcon heat={read.heat} />
          {HEAT_WORDS[read.heat]},
        </span>{' '}
        {verdictReason(read, where)}
      </p>
      <p className="mf-vd-sub">
        <Evidence read={read} team={team} venue={venue} />
      </p>
    </div>
  )
}

function Evidence({ read, team, venue }: { read: FormRead; team: TeamForm; venue: boolean }) {
  if (!read.n) return <>{team.wins + team.losses ? 'No games here yet' : 'No games yet this season'}</>
  const season = team.games.length ? team.games.reduce((s, g) => s + marginOf(g), 0) / team.games.length : 0
  return (
    <>
      Last {read.n}{' '}
      <span className="num">
        {read.wins}-{read.losses}
      </span>{' '}
      · <span className="num">{signedMargin(read.per, 1)}</span> a game ·{' '}
      {venue ? (
        <>since {shortDate(read.since)}</>
      ) : (
        <>
          season <span className="num">{signedMargin(season, 1)}</span>
        </>
      )}
    </>
  )
}

function VenueSwitch({
  on,
  neutral,
  away,
  home,
  onChange,
}: {
  on: boolean
  neutral: boolean
  away: string
  home: string
  onChange: (on: boolean) => void
}) {
  const noteId = useId()
  const group = useRef<HTMLDivElement>(null)
  if (neutral)
    return (
      <p className="mf-venue-off">
        <GlobeSimple size={16} aria-hidden="true" />
        Neutral site tonight: no home or road split, so every game counts.
      </p>
    )
  const options = [
    { on: false, label: 'All Games' },
    { on: true, label: "Tonight's Venue" },
  ]
  const key = (e: ReactKeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const next = e.key === 'Home' ? false : e.key === 'End' ? true : !on
    onChange(next)
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next ? 1 : 0]?.focus()
  }
  return (
    <div className="mf-venue">
      <div
        ref={group}
        className="mf-seg"
        role="radiogroup"
        aria-label="Games to read"
        aria-describedby={noteId}
        onKeyDown={key}
      >
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={on === o.on}
            tabIndex={on === o.on ? 0 : -1}
            onClick={() => onChange(o.on)}
          >
            {o.on && <MapPin size={15} aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>
      <p id={noteId} className="mf-venue-note">
        {on
          ? `${nick(home)} at home, ${nick(away)} on the road`
          : 'Every game this season, no preseason'}
      </p>
    </div>
  )
}

export function FormLoading() {
  return (
    <div className="mf mf-loading" aria-busy="true" aria-label="Loading both teams' games">
      <div className="mf-read">
        <div className="mf-verdicts">
          {[0, 1].map((i) => (
            <div key={i} className="mf-vd">
              <span className="mf-vd-logo mf-sk" />
              <span className="mf-sk mf-sk-line" />
              <span className="mf-sk mf-sk-sub" />
            </div>
          ))}
        </div>
      </div>
      <p className="mf-rule">Reading both teams' games this season…</p>
    </div>
  )
}

export function FormError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mf mf-error" role="alert">
      <p>Couldn't load the two teams' games just now.</p>
      <button type="button" className="mf-retry" onClick={onRetry}>
        Try Again
      </button>
    </div>
  )
}
