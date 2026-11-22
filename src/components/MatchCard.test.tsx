import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompareEstimate, CompareGame } from "../lib/iddaaCompare";
import { MatchCard } from "./MatchCard";

afterEach(cleanup);

const est = (
  name: string,
  team: string,
  pts: number,
  actual: Record<string, number> | null = null,
): CompareEstimate => ({
  name,
  player_id: name.length * 1000 + pts,
  team,
  minutes: 30,
  pts,
  reb: 4,
  ast: 5,
  stl: 1,
  blk: 0.4,
  three_pm: 2,
  played: actual == null ? null : true,
  actual,
});

const game = (over: Partial<CompareGame> = {}): CompareGame => ({
  game_id: 7,
  away: "OKC",
  home: "MIA",
  tip: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  checked: "",
  status: "scheduled",
  away_score: null,
  home_score: null,
  markets: [],
  players: [],
  estimates: [
    est("Shai Gilgeous-Alexander", "OKC", 32),
    est("Ajay Mitchell", "OKC", 17.2),
    est("Bam Adebayo", "MIA", 17.5),
  ],
  ...over,
});

describe("a match card", () => {
  it("lists our line for each player, one team at a time", () => {
    render(<MatchCard game={game()} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", {
      name: /Our estimates.*Thunder at Heat/,
    });
    expect(within(dialog).getByText("Shai Gilgeous-Alexander")).toBeTruthy();
    expect(within(dialog).queryByText("Bam Adebayo")).toBeNull();
    expect(within(dialog).getByText(/Tips in/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("tab", { name: /Miami Heat/ }));
    expect(within(dialog).getByText("Bam Adebayo")).toBeTruthy();
    expect(within(dialog).getByLabelText("PTS ours 17.5")).toBeTruthy();
  });

  it("shows what each player did after the final, and who sat out", () => {
    const done = game({
      status: "final",
      away_score: 117,
      home_score: 104,
      estimates: [
        est("Shai Gilgeous-Alexander", "OKC", 32, {
          pts: 35,
          reb: 5,
          ast: 7,
          stl: 2,
          blk: 1,
          three_pm: 3,
        }),
        { ...est("Ajay Mitchell", "OKC", 17.2), played: false },
      ],
    });
    render(<MatchCard game={done} onClose={() => {}} />);
    expect(screen.getByText("117–104")).toBeTruthy();
    expect(screen.getByLabelText("PTS ours 32.0, did 35")).toBeTruthy();
    expect(screen.getByText("Sat out")).toBeTruthy();
  });

  it("closes on Esc and on Close", () => {
    const onClose = vi.fn();
    render(<MatchCard game={game()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
