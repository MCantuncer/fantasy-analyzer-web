import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompareEstimate, CompareGame } from "../lib/iddaaCompare";
import type { FormGame, MatchForm, TeamForm } from "../lib/matchForm";
import { MatchCard } from "./MatchCard";

const formMock = vi.fn<(away: string, home: string) => Promise<MatchForm>>();
vi.mock("../api/client", async (orig) => ({
  ...(await orig<object>()),
  matchFormQuery: (away: string, home: string) => ({
    queryKey: ["match-form", away, home],
    queryFn: () => formMock(away, home),
    retry: false,
  }),
}));

afterEach(() => {
  cleanup();
  formMock.mockReset();
});

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// Five results, newest first: [points, opponent points, home].
function team(abbrev: string, rows: [number, number, boolean][]): TeamForm {
  const games: FormGame[] = rows.map(([points, opp, home], i) => ({
    game_id: 100 + i,
    date: `2026-11-${20 - i}`,
    start: "",
    home,
    neutral: false,
    kind: "regular",
    note: null,
    opponent: "BOS",
    opponent_name: "Boston Celtics",
    points,
    opponent_points: opp,
    won: points > opp,
    mvp: null,
    best: null,
  }));
  const wins = games.filter((g) => g.won).length;
  return { abbrev, name: abbrev, wins, losses: games.length - wins, games };
}

const FORM: MatchForm = {
  away: team("OKC", [
    [120, 100, false],
    [118, 101, true],
    [115, 99, false],
    [110, 108, true],
    [99, 101, false],
  ]),
  home: team("MIA", [
    [90, 100, true],
    [95, 104, false],
    [99, 101, true],
    [110, 101, true],
    [100, 109, false],
  ]),
  next: { game_id: 7, start: "", neutral: false, kind: "cup", note: "NBA Cup - Group Play" },
};

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
    const dialog = screen.getByRole("dialog", { name: "Thunder at Heat" });
    expect(within(dialog).getByText("Shai Gilgeous-Alexander")).toBeTruthy();
    expect(within(dialog).queryByText("Bam Adebayo")).toBeNull();
    expect(within(dialog).getByText(/Tips in/)).toBeTruthy();
    expect(formMock).not.toHaveBeenCalled(); // the teams' games load only once Form is looked at
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

  it("opens on Form from a Kupon pick: who is heating up, who is cooling off", async () => {
    formMock.mockResolvedValue(FORM);
    render(<MatchCard game={game()} onClose={() => {}} initialView="form" />);
    expect(formMock).toHaveBeenCalledWith("OKC", "MIA");
    expect(await screen.findByText(/won 4 straight/)).toBeTruthy();
    expect(screen.getByText("heating up,")).toBeTruthy();
    expect(screen.getByText("cooling off,")).toBeTruthy();
    expect(screen.getByText("NBA Cup")).toBeTruthy(); // tonight's game type in the title line
    expect(screen.getByRole("tab", { name: "Form" }).getAttribute("aria-selected")).toBe("true");
    // Tonight's venue: the Heat at home are 2-1 there, too few games to call.
    fireEvent.click(screen.getByRole("radio", { name: /Tonight's Venue/ }));
    expect(screen.getByText(/only 3 games at home so far/)).toBeTruthy();
    expect(screen.getByText("Heat at home, Thunder on the road")).toBeTruthy();
  });

  it("switches views with the arrow keys", async () => {
    formMock.mockResolvedValue(FORM);
    render(<MatchCard game={game()} onClose={() => {}} />);
    const views = screen.getByRole("tablist", { name: "View" });
    fireEvent.keyDown(views, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Form" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText(/cooling off/)).toBeTruthy();
    fireEvent.keyDown(views, { key: "End" });
    expect(screen.getByText("Shai Gilgeous-Alexander")).toBeTruthy();
  });

  it("says so when the games can't load", async () => {
    formMock.mockRejectedValue(new Error("down"));
    render(<MatchCard game={game()} onClose={() => {}} initialView="form" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });
});
