import { Fragment, type ReactNode } from "react";
import type { CardPlayer } from "../lib/playerCard";
import { PlayerLink } from "./PlayerCard";
import { PlayerHead } from "./PlayerHead";
import "./PlayerInline.css";

type Player = CardPlayer & { pro_team?: string | null };

/**
 * A player named inside a sentence: a small face, then his name, both opening his card. The face
 * is the decorative twin of the name link, so it stays out of the tab order. Not for use inside
 * another button.
 */
export function PlayerInline({
  player,
  children,
  face = true,
  size = 18,
}: {
  player: Player;
  /** What to show for the name, e.g. his last name. Left out, his full name. */
  children?: ReactNode;
  face?: boolean;
  size?: number;
}) {
  if (!face) return <PlayerLink player={player}>{children}</PlayerLink>;
  return (
    <span className="pin">
      <PlayerLink player={player} decorative>
        <PlayerHead player={player} size={size} team={player.pro_team} />
      </PlayerLink>
      <PlayerLink player={player}>{children}</PlayerLink>
    </span>
  );
}

/** Several players in a sentence, each linked, joined by ``sep`` ("A, B", "A and B", "A + B"). */
export function PlayerList({
  players,
  sep = ", ",
  name,
  face = true,
}: {
  players: Player[];
  sep?: string;
  /** What to show for each name, e.g. the last name. Left out, the full name. */
  name?: (p: Player) => string;
  face?: boolean;
}) {
  return (
    <>
      {players.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 && sep}
          <PlayerInline player={p} face={face}>
            {name?.(p)}
          </PlayerInline>
        </Fragment>
      ))}
    </>
  );
}

/** Kept players the way ``keptNames`` words them: "A", "A and B", then "A and 2 more". Each name links. */
export function KeptPlayers({
  players,
  face = true,
}: {
  players: Player[];
  face?: boolean;
}) {
  if (players.length <= 2)
    return <PlayerList players={players} sep=" and " face={face} />;
  return (
    <>
      <PlayerInline player={players[0]} face={face} /> and {players.length - 1}{" "}
      more
    </>
  );
}
