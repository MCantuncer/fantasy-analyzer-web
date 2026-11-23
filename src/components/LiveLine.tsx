import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { fetchLiveLines } from "../api/client";
import type { Game } from "../api/client";
import type { Credentials } from "../lib/credentials";
import {
  foulTag,
  honesty,
  rowSentence,
  scaleOf,
  sideRows,
  vsLine,
} from "../lib/liveline";
import { teamLight } from "../lib/nbaTeams";
import { useFeature } from "../lib/pro";
import { PlayerLink } from "./PlayerCard";
import { PlayerHead } from "./PlayerHead";
import { ProLock } from "./Pro";
import { LiveQuarters } from "./LiveQuarters";
import "./LiveLine.css";

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
  game: Game;
  team: Game["away"];
  day: number | null;
  leagueId: number;
  season: number;
  creds: Credentials | null;
}) {
  const pro = useFeature("pregame");
  const q = useQuery({
    queryKey: ["live-lines", leagueId, season, game.id, creds?.swid ?? null],
    queryFn: () => fetchLiveLines(leagueId, season, game.id, day, creds),
    enabled: pro && game.status === "live",
    staleTime: 50_000,
    refetchInterval: 60_000,
  });
  if (game.status !== "live") return null;
  if (!pro)
    return (
      <div className="lvl lvl-locked">
        <ProLock words="Where each player's night ends" />
      </div>
    );
  const data = q.data;
  if (!data || data.status !== "live" || data.elapsed == null) return null;
  const rows = sideRows(data, team.pro_team_id);
  if (!rows.length && !data.quarters) return null;
  const max = scaleOf(rows);
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  return (
    <section
      className="lvl"
      aria-label="Live line"
      style={
        { "--tl": teamLight(team.abbrev) ?? "var(--accent)" } as CSSProperties
      }
    >
      <header className="lvl-head">
        <h3>Live line</h3>
        <p className="lvl-sub">
          Where the quarters and each player end tonight
          {data.clock ? <>, as of {data.clock}</> : null}
        </p>
      </header>
      {data.quarters && (
        <>
          <LiveQuarters game={game} quarters={data.quarters} />
          <p className="lvl-note lvl-qnote small muted">
            Played quarters are real; the rest is our number, moved by the
            score. A team ahead of the margin we called gives back about 6.5% of
            the extra each quarter left; a team in the bonus scores about 0.1
            more a minute left in the quarter. Half of quarters land within 4
            points of our number.
          </p>
        </>
      )}
      {rows.length > 0 && (
        <>
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
              const v = vsLine(r);
              const pf = foulTag(r.fouls, data.elapsed ?? 0);
              return (
                <li key={r.player_id} className="lvl-row">
                  <span className="lvl-name">
                    <PlayerLink
                      player={{ id: r.player_id, name: r.name }}
                      decorative
                    >
                      <PlayerHead
                        player={{ id: r.player_id, name: r.name }}
                        size={22}
                        team={team.abbrev}
                      />
                    </PlayerLink>
                    <span className="lvl-who">
                      <PlayerLink player={{ id: r.player_id, name: r.name }} />
                    </span>
                    {pf && (
                      <span
                        className={`lvl-pf lvl-pf-${pf.level}`}
                        aria-hidden="true"
                      >
                        {pf.text}
                      </span>
                    )}
                    <span className="sr-only">
                      : {rowSentence(r, data.elapsed ?? 0)}
                    </span>
                  </span>
                  <span className="lvl-track" aria-hidden="true">
                    <span
                      className="lvl-rest"
                      style={{ width: pct(r.final) }}
                    />
                    <span className="lvl-now" style={{ width: pct(r.pts) }} />
                    <span
                      className="lvl-tick"
                      style={{ left: pct(r.line_pts) }}
                    />
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
                  <span
                    className={`lvl-n lvl-vs num ${v.dir}`}
                    aria-hidden="true"
                  >
                    {v.text}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="lvl-note small muted">
            From his line at tip-off, his night so far and the score. A quiet
            start isn't made up later; a big lead or deficit costs starters
            minutes, and so do foul trouble and 5 fouls. {honesty(data)}
          </p>
        </>
      )}
    </section>
  );
}
