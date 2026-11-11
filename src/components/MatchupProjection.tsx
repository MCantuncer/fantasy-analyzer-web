import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import {
  fetchMatchupProjection,
  retryDropped,
  retryDroppedDelay,
  type CrowdedDay,
  type LeagueRef,
  type MatchupProjection as Projection,
} from '../api/client'
import type { Credentials } from '../lib/credentials'
import { boxOrder, formatStat } from '../lib/league'
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
        return (
          <li key={`${who}-${first.date}`} className="proj-crowd-row">
            <div className="proj-crowd-top">
              <span className="proj-crowd-when">
                <span className="proj-crowd-who">{who}</span>
                {g.days.map((d) => dayLabel(d.date)).join(' & ')}
              </span>
              <span className={`proj-crowd-count${first.playing > first.slots ? ' over' : ''}`}>
                <b className="num">{first.playing}</b> playing
              </span>
            </div>
            <div className="proj-crowd-bench">
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
            </div>
          </li>
        )
      })}
    </>
  )
}

export function ProjectionView({ data, me, them }: { data: Projection; me: Side; them: Side }) {
  const cats = boxOrder(data.categories)
  const iWin = data.wins > data.losses
  const winner = iWin ? me : them
  const score = iWin ? `${data.wins}-${data.losses}` : `${data.losses}-${data.wins}`
  const crowded = data.my_crowded.length > 0 || data.their_crowded.length > 0
  return (
    <section className="proj" aria-labelledby="proj-title">
      <div className="proj-head">
        <h3 id="proj-title" className="eyebrow">
          Projected final
        </h3>
        <p className="proj-verdict" style={{ '--team': winner.colour } as CSSProperties}>
          <TeamCrest name={winner.name} colour={winner.colour} size={28} />
          <span className="proj-verdict-who">{iWin ? 'You win' : `${winner.name} win`}</span>
          <span className="num proj-verdict-score">{score}</span>
        </p>
      </div>
      <ul className="proj-cats">
        {cats.map((c) => {
          const side = c.winner === 'me' ? me : them
          return (
            <li
              key={c.stat}
              className={`proj-cat${c.close ? ' close' : ''}`}
              style={{ '--team': side.colour } as CSSProperties}
            >
              <span className="proj-stat">{c.stat}</span>
              <TeamCrest name={side.name} colour={side.colour} size={32} />
              <span className="sr-only">
                {c.winner === 'me' ? 'You' : side.name}
                {c.close ? ', close' : ''}
              </span>
              <span className="num proj-totals">
                <b className={c.winner === 'me' ? 'lead' : undefined}>{formatStat(c.stat, c.mine)}</b>
                <span className="muted">·</span>
                <b className={c.winner === 'them' ? 'lead' : undefined}>{formatStat(c.stat, c.theirs)}</b>
              </span>
            </li>
          )
        })}
      </ul>
      {crowded && (
        <div className="proj-crowd">
          <h4 className="eyebrow">Crowded days</h4>
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
