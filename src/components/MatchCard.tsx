import { ListBullets, Pulse, Trophy, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer } from "../lib/escapeStack";
import { matchFormQuery } from "../api/client";
import { clock, num } from "../lib/iddaaCompare";
import { typeTag } from "../lib/matchForm";
import type { CompareEstimate, CompareGame } from "../lib/iddaaCompare";
import { teamLight, teamName } from "../lib/nbaTeams";
import { usePlayerCard, usePlayerCardShown } from "../lib/playerCard";
import { FormError, FormLoading, FormView } from "./matchForm/FormView";
import { PlayerHead, TeamLogo } from "./PlayerHead";
import "./MatchCard.css";

/** Our line for every player in one game (Can 2026-11-22: the night's estimates table moved here, a
 *  card a match opens, in the pre-game box's style). Before tip-off the lines still move with news;
 *  once the game is final, what each player did sits under our number. */

// The site's stat order (PTS last); STL and BLK only where there is room.
const COLS = [
  ["MIN", "minutes", false],
  ["3PM", "three_pm", false],
  ["REB", "reb", false],
  ["AST", "ast", false],
  ["STL", "stl", true],
  ["BLK", "blk", true],
  ["PTS", "pts", false],
] as const;

const VIEWS = [
  ["form", "Form", Pulse],
  ["estimates", "Our Estimates", ListBullets],
] as const;

const nick = (abbrev: string) => {
  const n = teamName(abbrev);
  return n === abbrev ? abbrev : n.split(" ").slice(-1)[0];
};

/** "2h 12m" until tip-off, or null once it's past (or more than a day away). */
function countdown(tip: string, now: number): string | null {
  const ms = new Date(tip).getTime() - now;
  if (!(ms > 0) || ms > 24 * 3_600_000) return null;
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

type View = "form" | "estimates";

export function MatchCard({
  game,
  onClose,
  initialView = "estimates",
  initialSide = "away",
}: {
  game: CompareGame;
  onClose: () => void;
  initialView?: View;
  initialSide?: "away" | "home";
}) {
  const titleId = useId();
  const viewsId = useId();
  const [view, setView] = useState<View>(initialView);
  // Both teams' games load once the Form view has been looked at, then stay for the card's life.
  const [formSeen, setFormSeen] = useState(initialView === "form");
  const form = useQuery({ ...matchFormQuery(game.away, game.home), enabled: formSeen });
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const under = usePlayerCardShown();
  const [side, setSide] = useState<"away" | "home">(initialSide);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    heading.current?.focus({ preventScroll: true });
    const body = document.body.style;
    const before = body.overflow;
    body.overflow = "hidden";
    return () => {
      body.overflow = before;
      back?.focus?.({ preventScroll: true });
    };
  }, []);
  useEscapeLayer(true, onClose);

  const final = game.status === "final";
  const score =
    game.away_score != null && game.home_score != null
      ? `${game.away_score}–${game.home_score}`
      : "";
  const live =
    !final && (game.status === "live" || new Date(game.tip).getTime() <= now);
  const left = countdown(game.tip, now);
  const rows = game.estimates ?? [];
  const team = side === "away" ? game.away : game.home;
  const shown = rows.filter((e) => e.team === team);

  const pick = (v: View) => {
    setView(v);
    if (v === "form") setFormSeen(true);
  };
  const next = form.data?.next;
  const tag = next && next.game_id === game.game_id ? typeTag(next.kind, next.note) : null;

  // Keep Tab inside the card while it is open.
  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [
      ...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="mc-layer" inert={under}>
      <div className="mc-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialog}
        className={`mc-sheet${under ? " mc-under" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trap}
      >
        <div className="mc-title">
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            <span className="mc-game">
              {nick(game.away)} at {nick(game.home)}
            </span>
          </h2>
          <span className="mc-line">
            {final ? (
              <>
                <b>Final</b> <span className="num">{score}</span>
              </>
            ) : live ? (
              <>
                <span className="mc-live" aria-hidden="true" />
                <b>Live</b> {score && <span className="num">{score}</span>}
              </>
            ) : (
              <>
                <b className="num">{clock(game.tip)}</b>
                {left && (
                  <>
                    <i />
                    Tips in <b className="num">{left}</b>
                  </>
                )}
              </>
            )}
            {tag && (
              <>
                <i />
                <span className={`mc-type ${tag.variant}`}>
                  {tag.variant === "cup" && <Trophy size={13} aria-hidden="true" />}
                  {tag.label}
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            className="mc-close"
            aria-label="Close"
            aria-keyshortcuts="Escape"
            onClick={onClose}
          >
            <X size={16} weight="bold" aria-hidden="true" />
            <span className="mc-close-label">Close</span>
            <kbd>Esc</kbd>
          </button>
        </div>
        <div
          className="mc-views"
          role="tablist"
          aria-label="View"
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            const next: View =
              e.key === "Home" ? "form" : e.key === "End" ? "estimates" : view === "form" ? "estimates" : "form";
            pick(next);
            e.currentTarget.querySelector<HTMLButtonElement>(`#${CSS.escape(viewsId)}-${next}`)?.focus();
          }}
        >
          {VIEWS.map(([v, label, Icon]) => (
            <button
              key={v}
              id={`${viewsId}-${v}`}
              type="button"
              role="tab"
              className="mc-view"
              aria-selected={view === v}
              aria-controls={`${viewsId}-panel`}
              tabIndex={view === v ? 0 : -1}
              onClick={() => pick(v)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        {view === "form" ? (
          <div
            id={`${viewsId}-panel`}
            className="mc-scroll mc-form"
            role="tabpanel"
            aria-labelledby={`${viewsId}-form`}
          >
            {form.data ? (
              <FormView
                form={form.data}
                venueNeutral={form.data.next?.neutral === true}
                initialSide={initialSide}
                tip={game.tip}
              />
            ) : form.isError ? (
              <FormError onRetry={() => void form.refetch()} />
            ) : (
              <FormLoading />
            )}
          </div>
        ) : (
          <div
            id={`${viewsId}-panel`}
            className="mc-estimates"
            role="tabpanel"
            aria-labelledby={`${viewsId}-estimates`}
          >
        <div className="mc-switch" role="tablist" aria-label="Team">
          {(["away", "home"] as const).map((s) => {
            const ab = s === "away" ? game.away : game.home;
            const n = rows.filter((e) => e.team === ab).length;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={side === s}
                className="mc-tab"
                style={
                  {
                    "--mc-club": teamLight(ab) ?? "var(--border)",
                  } as CSSProperties
                }
                onClick={() => setSide(s)}
              >
                <TeamLogo abbrev={ab} size={22} fallback />
                <span className="mc-tab-name">{teamName(ab)}</span>
                <span className="mc-tab-ab">{ab}</span>
                <span className="mc-n num">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="mc-scroll">
          <div className="mc-row mc-head" aria-hidden="true">
            <span className="mc-who">Player</span>
            {COLS.map(([h, , wide]) => (
              <span
                key={h}
                className={`c${wide ? " wide" : ""}${h === "MIN" ? " min" : ""}${h === "PTS" ? " pts" : ""}`}
              >
                {h}
              </span>
            ))}
          </div>
          {shown.length ? (
            <ol className="mc-list">
              {shown.map((e) => (
                <Row key={e.player_id} e={e} final={final} />
              ))}
            </ol>
          ) : (
            <p className="mc-empty">
              No line for {teamName(team)} yet: we list players expected to play
              10+ minutes.
            </p>
          )}
          <p className="mc-foot">
            {final
              ? "Our line as it stood at tip-off, with what each player did under it."
              : "Our line for each player expected to play 10+ minutes. Lines move with lineup news and freeze at tip-off."}
          </p>
        </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Row({ e, final }: { e: CompareEstimate; final: boolean }) {
  const card = usePlayerCard();
  const who = { id: e.player_id, name: e.name };
  const got = e.actual;
  return (
    <li className="mc-row">
      <span className="mc-who">
        <span className="mc-face" aria-hidden="true">
          <PlayerHead player={who} team={e.team} size={30} />
        </span>
        <span className="mc-nmw">
          {card ? (
            <button
              type="button"
              className="mc-nm"
              onPointerEnter={(ev) =>
                ev.pointerType === "mouse" && card.prefetch(who)
              }
              onClick={() => card.open(who)}
            >
              {e.name}
            </button>
          ) : (
            <span className="mc-nm">{e.name}</span>
          )}
          {final && !got && <span className="mc-dnp">Sat out</span>}
        </span>
      </span>
      {COLS.map(([h, k, wide]) => {
        const res = k === "minutes" ? null : got?.[k];
        return (
          <span
            key={h}
            className={`c${wide ? " wide" : ""}${h === "MIN" ? " min" : ""}${h === "PTS" ? " pts" : ""}`}
            aria-label={`${h} ours ${e[k].toFixed(1)}${res != null ? `, did ${res}` : ""}`}
          >
            <span className="num">{e[k].toFixed(1)}</span>
            {res != null && <small className="num">{num(res)}</small>}
          </span>
        );
      })}
    </li>
  );
}
