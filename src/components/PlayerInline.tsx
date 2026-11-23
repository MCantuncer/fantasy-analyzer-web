import { Fragment, type ReactNode } from 'react'
import type { CardPlayer } from '../lib/playerCard'
import { PlayerLink } from './PlayerCard'
import { PlayerHead } from './PlayerHead'
import './PlayerInline.css'

type Player = CardPlayer & { pro_team?: string | null }

/**
 * A player named inside a sentence: a small face, then his name, both opening his card. The face
 * is the decorative twin of the name link, so it stays out of the tab order. ``tail`` is
 * punctuation that belongs to the name ("," or ":"): held on its line, since a line can break
 * right after a link. Not for use inside another button.
 */
export function PlayerInline({
  player,
  children,
  face = true,
  size = 18,
  tail,
}: {
  player: Player
  /** What to show for the name, e.g. his last name. Left out, his full name. */
  children?: ReactNode
  face?: boolean
  size?: number
  tail?: string
}) {
  const name = <PlayerLink player={player}>{children}</PlayerLink>
  if (!face && !tail) return name
  return (
    <span className="pin">
      {face && (
        <PlayerLink player={player} decorative>
          <PlayerHead player={player} size={size} team={player.pro_team} />
        </PlayerLink>
      )}
      {name}
      {tail}
    </span>
  )
}

/**
 * Several players in a sentence, each linked, joined by ``sep`` ("A, B", "A and B", "A + B").
 * ``tail`` follows the last name ("."), held on its line like the commas.
 */
export function PlayerList({
  players,
  sep = ', ',
  name,
  face = true,
  tail,
}: {
  players: Player[]
  sep?: string
  /** What to show for each name, e.g. the last name. Left out, the full name. */
  name?: (p: Player) => string
  face?: boolean
  tail?: string
}) {
  // A separator's own punctuation (the comma of ", ") stays with the name before it.
  const mark = /^\S*/.exec(sep)![0]
  const gap = sep.slice(mark.length)
  return (
    <>
      {players.map((p, i) => {
        const last = i === players.length - 1
        return (
          <Fragment key={p.id}>
            {i > 0 && gap}
            <PlayerInline player={p} face={face} tail={(last ? tail : mark) || undefined}>
              {name?.(p)}
            </PlayerInline>
          </Fragment>
        )
      })}
    </>
  )
}

/** Kept players the way ``keptNames`` words them: "A", "A and B", then "A and 2 more". Each name links. */
export function KeptPlayers({ players, face = true }: { players: Player[]; face?: boolean }) {
  if (players.length <= 2) return <PlayerList players={players} sep=" and " face={face} />
  return (
    <>
      <PlayerInline player={players[0]} face={face} /> and {players.length - 1} more
    </>
  )
}
