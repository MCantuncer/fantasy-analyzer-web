import type { CSSProperties } from "react";
import type { Game, LiveQuarters as Quarters } from "../api/client";
import { gameCell, quarterCells, quarterSentence } from "../lib/liveline";
import { teamLight } from "../lib/nbaTeams";
import { TeamLogo } from "./PlayerHead";
import "./LiveQuarters.css";

const HEADS = ["1st", "2nd", "3rd", "4th"];

/**
 * Quarter by quarter once a game is on (Can 2026-11-23), the pre-game Stave's live turn: the quarters played
 * are real (solid), the one in progress shows where it ends with its points so far, and the rest are our
 * number (outlined) moved by the score so far, with what we had at tip-off when that moved it. The quarter
 * in progress is lit gold (live). Prefix lqt-.
 */
export function LiveQuarters({
  game,
  quarters,
}: {
  game: Game;
  quarters: Quarters;
}) {
  const period = quarters.period;
  const sides = [
    { team: game.away, q: quarters.away },
    { team: game.home, q: quarters.home },
  ];
  return (
    <div className="lqt">
      <table className="lqt-table">
        <caption className="sr-only">
          Quarter by quarter: real when played, our number for the rest.{" "}
          {sides
            .map((s) => quarterSentence(s.team.name, s.q, period))
            .join(" ")}
        </caption>
        <thead aria-hidden="true">
          <tr>
            <th />
            {HEADS.map((h, i) => (
              <th
                key={h}
                className={
                  period <= 4 && i === period - 1 ? "lqt-on" : undefined
                }
              >
                {h}
              </th>
            ))}
            <th className="lqt-g">Game</th>
          </tr>
        </thead>
        <tbody aria-hidden="true">
          {sides.map(({ team, q }) => {
            const g = gameCell(q, period);
            return (
              <tr
                key={team.pro_team_id}
                style={
                  {
                    "--c": teamLight(team.abbrev) ?? "var(--accent)",
                  } as CSSProperties
                }
              >
                <th scope="row">
                  <TeamLogo abbrev={team.abbrev} size={20} />
                  <span>{team.abbrev}</span>
                  {q.bonus && <small className="lqt-bonus">Bonus</small>}
                </th>
                {quarterCells(q, period).map((c, i) => (
                  <td key={i} className={`lqt-${c.kind}`}>
                    <span className="lqt-n num">{c.value}</span>
                    {c.kind === "now" && <small>{c.sofar} now</small>}
                    {c.kind === "next" && c.was != null && (
                      <small>was {c.was}</small>
                    )}
                  </td>
                ))}
                <td className="lqt-g">
                  <span className="lqt-n num">
                    {g.overtime ? g.now : g.ends}
                  </span>
                  <small>{g.overtime ? "+ overtime" : `${g.now} now`}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
