import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Me } from "../api/client";
import type {
  BookCompare,
  CompareGame,
  ComparePlayer,
} from "../lib/iddaaCompare";
import { setPlayerCardHost } from "../lib/playerCard";
import { EstimatesTeaser, IddaaCompare } from "./IddaaCompare";
import { ProProvider } from "./Pro";

/** Every player name on Our Estimates opens his card (Can 2026-11-23). */

const PRO: Me = {
  id: 1,
  email: "can@example.com",
  has_google: false,
  leagues: [],
  notices: [],
  admin: true,
  plan: "pro",
  features: ["estimates"],
  gifted: false,
  payment_due: false,
};

const pl = (
  name: string,
  id: number,
  ours: number,
  book: number,
): ComparePlayer => ({
  name,
  player_id: id,
  team: "NY",
  stat: "reb",
  played: null,
  ladder: [],
  rungs: Array.from({ length: 12 }, (_, i) => ({
    n: i + 1,
    odd: 1.4 + i * 0.3,
    book: 0.5,
    ours: 0.55,
    value: null,
    hit: null,
  })),
  ours,
  book,
  actual: null,
  gap: ours - book,
  ours_hit: null,
  book_hit: null,
  closer: null,
});

function night(players: ComparePlayer[]): BookCompare {
  const g: CompareGame = {
    game_id: 1,
    away: "IND",
    home: "NY",
    tip: "2099-11-22T22:00:00Z",
    checked: "",
    status: "scheduled",
    away_score: null,
    home_score: null,
    markets: [],
    players,
  };
  return {
    season: 2027,
    day: 34,
    date: "2026-11-22",
    days: [34],
    nights: [{ day: 34, date: "2026-11-22", games: 1 }],
    bands: {
      pts: 5,
      reb: 2,
      ast: 2,
      stl: 1,
      blk: 1,
      three_pm: 1,
      team_pts: 8,
      total: 12,
      margin: 8,
    },
    look: {
      checked: "2026-11-22T21:33:00Z",
      ok: true,
      error: null,
      games: 1,
      matched: 1,
    },
    games: [g],
    tally: [],
  };
}

function mount(data: BookCompare) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).includes("/api/book-compare/record")
      ? new Response("{}", { status: 404 })
      : new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ProProvider me={PRO} signedIn theme="dark" onNeedAccount={vi.fn()}>
        <IddaaCompare onBack={vi.fn()} />
      </ProProvider>
    </QueryClientProvider>,
  );
}

const host = () => {
  const card = { open: vi.fn(), prefetch: vi.fn() };
  act(() => setPlayerCardHost(card));
  return card;
};

describe("Player names on Our Estimates", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    setPlayerCardHost(null);
  });

  it('opens the card from "Biggest the other way" when no line has ours above', async () => {
    const card = host();
    mount(
      night([
        pl("Josh Hart", 41, 5.0, 7.0),
        pl("Mitchell Robinson", 42, 6.0, 6.5),
      ]),
    );
    const note = (await screen.findByText(/Biggest the other way/)).closest(
      "p",
    )!;
    expect(note.textContent).toBe(
      "No line had ours above the book. Biggest the other way: Josh Hart Rebounds, Book 7.0 vs Ours 5.0.",
    );
    fireEvent.click(within(note).getByRole("button", { name: "Josh Hart" }));
    expect(card.open).toHaveBeenCalledWith({ id: 41, name: "Josh Hart" });
  });

  it("opens the card from How divided's biggest-gap note", async () => {
    const card = host();
    mount(
      night([
        pl("Josh Hart", 41, 9.0, 7.0),
        pl("Mitchell Robinson", 42, 6.0, 6.5),
      ]),
    );
    const sec = (
      await screen.findByRole("heading", { level: 2, name: "How divided" })
    ).closest("section")!;
    const notes = sec.querySelector(".ic-strip .notes") as HTMLElement;
    expect(notes.textContent).toMatch(/biggest \+2(\.0)? Hart$/);
    fireEvent.click(within(notes).getByRole("button", { name: "Hart" }));
    expect(card.open).toHaveBeenCalledWith({ id: 41, name: "Josh Hart" });
  });

  it("opens the card from a pinned mark's name and face, and keeps the mark's card up under it", async () => {
    const card = host();
    mount(night([pl("Josh Hart", 41, 9.0, 7.0)]));
    const sec = (
      await screen.findByRole("heading", { level: 2, name: "How divided" })
    ).closest("section")!;
    const field = sec.querySelector(".ic-fld") as HTMLElement;
    // a hover preview stays plain text; a pinned card links the name
    fireEvent.keyDown(field, { key: "End" });
    const preview = document.querySelector(".ic-mc") as HTMLElement;
    expect(preview.querySelector(".ic-mc-who b")!.textContent).toBe(
      "Josh Hart",
    );
    expect(preview.querySelector(".pc-link")).toBeNull();
    fireEvent.keyDown(field, { key: "Enter" });
    const pinned = screen.getByRole("dialog", { name: /^Josh Hart, Rebounds/ });
    const name = within(pinned).getByRole("button", { name: "Josh Hart" });
    fireEvent.pointerDown(name);
    fireEvent.click(name);
    expect(card.open).toHaveBeenCalledWith({ id: 41, name: "Josh Hart" });
    const face = pinned.querySelector<HTMLButtonElement>(
      "button.pc-link-face",
    )!;
    expect(face.tabIndex).toBe(-1);
    expect(face.querySelector(".ic-face .head")).toBeTruthy();
    // a press inside the player card leaves the mark's card where it was
    const layer = document.createElement("div");
    layer.className = "pc-layer";
    document.body.appendChild(layer);
    fireEvent.pointerDown(layer);
    expect(
      screen.getByRole("dialog", { name: /^Josh Hart, Rebounds/ }),
    ).toBeTruthy();
    layer.remove();
  });
  it("shows the biggest gap's small face on the My leagues way in", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify(night([pl("Josh Hart", 41, 9.0, 7.0)])), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ProProvider me={PRO} signedIn theme="dark" onNeedAccount={vi.fn()}>
          <EstimatesTeaser onOpen={vi.fn()} />
        </ProProvider>
      </QueryClientProvider>,
    );
    const who = await screen.findByText("Josh Hart");
    const row = who.closest(".ic-teaser-pl")!;
    expect(row.querySelector(".head img")!.getAttribute("src")).toContain("41");
    // the whole card is the way in, so nothing inside it is a second button
    expect(row.closest("button")!.querySelector("button")).toBeNull();
  });
});
