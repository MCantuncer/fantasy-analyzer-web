import { useState, type CSSProperties } from 'react'
import { headshotUrl, teamLogoUrl } from '../lib/league'
import { teamLight } from '../lib/nbaTeams'
import './PlayerHead.css'

interface Player {
  id: number
  name: string
}

/** The plain head-and-shoulders shape shown while a face is missing. */
function Silhouette() {
  return (
    <svg className="head-sil" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="15.5" r="7.2" />
      <path d="M5.5 41c0-8.4 6.5-13.6 14.5-13.6S34.5 32.6 34.5 41z" />
    </svg>
  )
}

/**
 * A player's face in a soft square, lit from below by their NBA team's colour with a 2px edge in
 * that colour. The ESPN headshot is lazy loaded; rookies and two-way players without a photo (or a
 * blocked image) get a neutral silhouette. Decorative: the name always sits beside it.
 */
export function PlayerHead({
  player,
  size = 32,
  team,
}: {
  player: Player
  size?: number
  /** NBA team abbreviation as ESPN writes it; leave out for a free agent. */
  team?: string | null
}) {
  const [failed, setFailed] = useState(false)
  const tc = teamLight(team)
  const style = { width: size, height: size, ...(tc ? { '--tc': tc } : {}) } as CSSProperties
  const photo = !failed && player.id > 0
  return (
    <span className={`head${tc ? ' head-team' : ''}`} style={style} aria-hidden="true">
      {photo ? (
        <img
          className="head-img"
          src={headshotUrl(player.id)}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <Silhouette />
      )}
    </span>
  )
}

/** Overlapping headshots for the players on one side of a deal. */
export function HeadStack({
  players,
  size = 32,
}: {
  players: (Player & { pro_team?: string | null })[]
  size?: number
}) {
  if (!players.length) return null
  return (
    <span className="head-stack" aria-hidden="true">
      {players.slice(0, 3).map((p) => (
        <PlayerHead key={p.id} player={p} size={size} team={p.pro_team} />
      ))}
    </span>
  )
}

/** A small NBA team logo; hidden when ESPN has none for the abbreviation. */
export function TeamLogo({ abbrev, size = 20 }: { abbrev: string | null | undefined; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!abbrev || failed) return null
  return (
    <img
      className="team-logo"
      src={teamLogoUrl(abbrev)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
