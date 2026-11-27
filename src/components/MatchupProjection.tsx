import { useQuery } from '@tanstack/react-query'
import { ChartLineUp } from '@phosphor-icons/react'
import {
  fetchMatchupProjection,
  retryDropped,
  retryDroppedDelay,
  type CrowdedDay,
  type LeagueRef,
  type MatchupProjection as Projection,
} from '../api/client'
import type { Credentials } from '../lib/credentials'
import { CatStripPick } from './CatStrip'
import './MatchupProjection.css'
import { PlayerLink } from './PlayerCard'
import { PlayerHead } from './PlayerHead'
import { TeamCrest } from './TeamCrest'

interface Side {
  name: string
  colour: string | undefined
}

interface Props {
  leagueRef: LeagueRef
  creds: Credentials | null
  /** Whose matchup: needed for a team picked before verifying. */
  teamId?: number | null
  me: Side
  them: Side
}

/** "D. Mitchell" for "Davion Mitchell": room for three chips on a phone row. */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name
}

/** Days that bench the same players, as one row. */
function grouped(days: CrowdedDay[]) {
  const out: { days: CrowdedDay[]; key: string }[] = []
  for (const d of days) {
    const key = d.sit.map((p) => p.id).join(',')
    const last = out[out.length - 1]
    if (last && last.key === key) last.days.push(d)
    else out.push({ days: [d], key })
  }
  return out
}

function dayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function CrowdRows({ who, days }: { who: string; days: CrowdedDay[] }) {
  return (
    <>
      {grouped(days).map((g) => {
        const first = g.days[0]
        const over = first.playing > first.slots
        return (
          <li key={`${who}-${first.date}`} className="proj-crowd-row">
            <span className="proj-crowd-when">
              <span className="proj-crowd-who">{who}</span>
              {g.days.map((d) => dayLabel(d.date)).join(' & ')}
            </span>
            <span className={`proj-crowd-count${over ? ' over' : ''}`}>
              <b className="num">{first.playing}</b> playing
            </span>
            <span className="proj-crowd-bench">
              <span className="proj-bench-label">Bench</span>
              <ul className="proj-bench" aria-label={`${who} bench`}>
                {first.sit.map((p) => (
                  <li key={p.id}>
                    <PlayerLink player={p} className="proj-benched">
                      <PlayerHead player={p} size={24} />
                      <span aria-hidden="true">{shortName(p.name)}</span>
                      <span className="sr-only">{p.name}</span>
                    </PlayerLink>
                  </li>
                ))}
              </ul>
            </span>
          </li>
        )
      })}
    </>
  )
}

export function ProjectionView({ data, me, them }: { data: Projection; me: Side; them: Side }) {
  const iWin = data.wins > data.losses
  const winner = iWin ? me : them
  const score = iWin ? `${data.wins}–${data.losses}` : `${data.losses}–${data.wins}`
  const crowded = data.my_crowded.length > 0 || data.their_crowded.length > 0
  return (
    <section className="proj" aria-labelledby="proj-title">
      <div className="proj-head">
        <h3 id="proj-title" className="proj-title">
          <ChartLineUp className="proj-ic" aria-hidden="true" />
          Projected final
        </h3>
        <p className="proj-verdict">
          <TeamCrest name={winner.name} colour={winner.colour} size={22} />
          <span className="proj-verdict-who">{iWin ? 'You win' : `${winner.name} win`}</span>
          <b className="num proj-verdict-score">{score}</b>
        </p>
      </div>
      <CatStripPick
        rows={data.categories}
        them={them}
        label={`Projected final: ${iWin ? 'you win' : `${winner.name} win`} ${score}, by category`}
      />
      {crowded && (
        <div className="proj-crowd">
          <h4 className="proj-sub">Crowded days</h4>
          <ul className="proj-crowd-list">
            <CrowdRows who="You" days={data.my_crowded} />
            <CrowdRows who={them.name} days={data.their_crowded} />
          </ul>
        </div>
      )}
    </section>
  )
}

/** Your matchup projected to Sunday. Shows nothing until it loads, or when there's no projection. */
export default function MatchupProjection({ leagueRef, creds, teamId = null, me, them }: Props) {
  const q = useQuery({
    queryKey: ['matchup-projection', leagueRef.leagueId, leagueRef.season, teamId, creds?.swid ?? null],
    queryFn: () => fetchMatchupProjection(leagueRef, creds, teamId),
    retry: retryDropped,
    retryDelay: retryDroppedDelay,
    staleTime: 10 * 60_000,
  })
  if (!q.data) return null
  return <ProjectionView data={q.data} me={me} them={them} />
}
