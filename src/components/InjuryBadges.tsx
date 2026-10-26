import type { PlayerRef } from '../api/client'

const LABELS: Record<string, string> = {
  DAY_TO_DAY: 'Day-to-day',
  OUT: 'Out',
  INJURY_RESERVE: 'IR',
  SUSPENSION: 'Suspended',
}

const SEASON_GAMES = 82
const PRONE_HINT =
  'Missed many games in recent seasons, so trades count him for fewer games. A healthy start this season eases this.'

const healthy = (p: PlayerRef) => p.injury_status === 'ACTIVE' || p.injury_status === 'NORMAL'

/** Flags anyone in a deal who isn't fully healthy, or who keeps missing games, so neither is a surprise. */
export function InjuryBadges({ players }: { players: PlayerRef[] }) {
  const hurt = players.filter((p) => !healthy(p))
  const prone = players.filter((p) => healthy(p) && p.injury_prone)
  if (!hurt.length && !prone.length) return null
  const who = (p: PlayerRef) => (players.length > 1 ? `${p.name.split(' ').slice(-1)[0]}: ` : '')
  return (
    <>
      {hurt.map((p) => (
        <span key={p.id} className="badge badge-bad injury-badge">
          {who(p)}
          {LABELS[p.injury_status] ?? p.injury_status.replace(/_/g, ' ').toLowerCase()}
        </span>
      ))}
      {prone.map((p) => (
        <span key={p.id} className="badge badge-warn injury-badge" title={PRONE_HINT}>
          {who(p)}Injury-prone
          {p.games_share != null && ` · ~${Math.round(p.games_share * SEASON_GAMES)} of ${SEASON_GAMES} games`}
        </span>
      ))}
    </>
  )
}
