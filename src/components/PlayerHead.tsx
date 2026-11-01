import { useState } from 'react'
import { headshotUrl, initials, teamLogoUrl } from '../lib/league'

interface Player {
  id: number
  name: string
}

/**
 * A round player headshot, lazy loaded. Falls back to the player's initials when ESPN has no
 * photo (rookies, two-way players) or the image is blocked. Decorative: the name sits beside it.
 */
export function PlayerHead({ player, size = 32 }: { player: Player; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) }
  if (failed || player.id <= 0) {
    return (
      <span className="head head-initials num" style={style} aria-hidden="true">
        {initials(player.name)}
      </span>
    )
  }
  return (
    <img
      className="head"
      src={headshotUrl(player.id)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      style={style}
      onError={() => setFailed(true)}
    />
  )
}

/** Overlapping headshots for the players on one side of a deal. */
export function HeadStack({ players, size = 32 }: { players: Player[]; size?: number }) {
  if (!players.length) return null
  return (
    <span className="head-stack" aria-hidden="true">
      {players.slice(0, 3).map((p) => (
        <PlayerHead key={p.id} player={p} size={size} />
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
