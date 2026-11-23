import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { fetchLiveLines } from '../api/client'
import type { Game } from '../api/client'
import type { Credentials } from '../lib/credentials'
import { honesty, rowSentence, scaleOf, sideRows, vsLine } from '../lib/liveline'
import { teamLight } from '../lib/nbaTeams'
import { useFeature } from '../lib/pro'
import { PlayerLink } from './PlayerCard'
import { ProLock } from './Pro'
import './LiveLine.css'

/**
 * Live line under the box score of a game in progress (Can 2026-11-23): where each player of the shown team
 * ends tonight, from his line at tip-off, his night so far and the score. One track a player, all on the same
 * scale: what he has (solid), what is still to come (soft), his line at tip-off (a tick). Pro. Prefix lvl-.
 */
export function LiveLine({
  game,
  team,
  day,
  leagueId,
  season,
  creds,
}: {
  game: Game
  team: Game['away']
  day: number | null
  leagueId: number
  season: number
  creds: Credentials | null
}) {
  const pro = useFeature('pregame')
  const q = useQuery({
    queryKey: ['live-lines', leagueId, season, game.id, creds?.swid ?? null],
    queryFn: () => fetchLiveLines(leagueId, season, game.id, day, creds),
    enabled: pro && game.status === 'live',
    staleTime: 50_000,
    refetchInterval: 60_000,
  })
  if (game.status !== 'live') return null
  if (!pro)
    return (
      <div className="lvl lvl-locked">
        <ProLock words="Where each player's night ends" />
      </div>
    )
  const data = q.data
  if (!data || data.status !== 'live' || data.elapsed == null) return null
  const rows = sideRows(data, team.pro_team_id)
  if (!rows.length) return null
  const max = scaleOf(rows)
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`
  return (
    <section
      className="lvl"
      aria-label="Live line"
      style={{ '--tl': teamLight(team.abbrev) ?? 'var(--accent)' } as CSSProperties}
    >
      <header className="lvl-head">
        <h3>Live line</h3>
        <p className="lvl-sub">
          Where each player ends tonight{data.clock ? <>, as of {data.clock}</> : null}
        </p>
      </header>
      <div className="lvl-cols" aria-hidden="true">
        <span />
        <span />
        <span>Now</span>
        <span>Ends</span>
        <span className="lvl-ln">Line</span>
        <span>vs Line</span>
      </div>
      <ol className="lvl-rows">
        {rows.map((r) => {
          const v = vsLine(r)
          return (
            <li key={r.player_id} className="lvl-row">
              <span className="lvl-name">
                <PlayerLink player={{ id: r.player_id, name: r.name }} />
                <span className="sr-only">: {rowSentence(r)}</span>
              </span>
              <span className="lvl-track" aria-hidden="true">
                <span className="lvl-rest" style={{ width: pct(r.final) }} />
                <span className="lvl-now" style={{ width: pct(r.pts) }} />
                <span className="lvl-tick" style={{ left: pct(r.line_pts) }} />
              </span>
              <span className="lvl-n num" aria-hidden="true">
                {r.pts}
              </span>
              <span className="lvl-n lvl-end num" aria-hidden="true">
                {Math.round(r.final)}
              </span>
              <span className="lvl-n lvl-ln num" aria-hidden="true">
                {Math.round(r.line_pts)}
              </span>
              <span className={`lvl-n lvl-vs num ${v.dir}`} aria-hidden="true">
                {v.text}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="lvl-note small muted">
        From his line at tip-off, his night so far and the score. A quiet start isn't made up later; a big lead
        or deficit costs starters minutes. {honesty(data)}
      </p>
    </section>
  )
}
