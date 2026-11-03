import { Fragment } from 'react'
import type { PlayerRef } from '../api/client'
import { DurabilityScore } from './DurabilityScore'
import './InjuryBadges.css'

const LABELS: Record<string, string> = {
  DAY_TO_DAY: 'Day-to-day',
  OUT: 'Out',
  INJURY_RESERVE: 'IR',
  SUSPENSION: 'Suspended',
}

const healthy = (p: PlayerRef) => p.injury_status === 'ACTIVE' || p.injury_status === 'NORMAL'

export function InjuryBadges({ players }: { players: PlayerRef[] }) {
  const hurt = players.filter((p) => !healthy(p))
  // A player who is out already shows that; the durability score is for healthy players who often miss games.
  const prone = players.filter((p) => healthy(p) && p.injury_prone && p.games_share != null)
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
        <DurabilityScore key={p.id} player={p} prefix={who(p)} />
      ))}
    </>
  )
}

/** "A + B" with each player's injury or durability mark right after his own name. */
export function NamesWithSignals({ players }: { players: PlayerRef[] }) {
  return (
    <>
      {players.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && ' + '}
          {p.name}
          <InjuryBadges players={[p]} />
        </Fragment>
      ))}
    </>
  )
}
