import type { PlayerRef } from '../api/client'

const LABELS: Record<string, string> = {
  DAY_TO_DAY: 'Day-to-day',
  OUT: 'Out',
  INJURY_RESERVE: 'IR',
  SUSPENSION: 'Suspended',
}

/** Flags anyone in a deal who isn't fully healthy, so an injury is never a surprise. */
export function InjuryBadges({ players }: { players: PlayerRef[] }) {
  const hurt = players.filter((p) => p.injury_status !== 'ACTIVE' && p.injury_status !== 'NORMAL')
  if (!hurt.length) return null
  return (
    <>
      {hurt.map((p) => (
        <span key={p.id} className="badge badge-bad injury-badge">
          {players.length > 1 ? `${p.name.split(' ').slice(-1)[0]}: ` : ''}
          {LABELS[p.injury_status] ?? p.injury_status.replace(/_/g, ' ').toLowerCase()}
        </span>
      ))}
    </>
  )
}
