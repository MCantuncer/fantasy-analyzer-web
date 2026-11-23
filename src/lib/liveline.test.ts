import { describe, expect, it } from "vitest";
import type { LiveLines, LivePlayerLine } from "../api/client";
import {
  gameCell,
  honesty,
  quarterCells,
  quarterSentence,
  rowSentence,
  scaleOf,
  sideRows,
  vsLine,
} from "./liveline";

const row = (over: Partial<LivePlayerLine>): LivePlayerLine => ({
  player_id: 1,
  name: "Cade Cunningham",
  pro_team_id: 8,
  pts: 6,
  minutes: 18,
  line_pts: 26,
  line_minutes: 35,
  final: 18.4,
  rest: 12.4,
  minutes_left: 16.5,
  ...over,
});
const data: LiveLines = {
  league_id: 1,
  season: 2027,
  day: 30,
  game_id: 9,
  status: "live",
  clock: "Half",
  elapsed: 24,
  half_within: 3.1,
  most_within: 5.5,
  lines: [
    row({}),
    row({
      player_id: 2,
      name: "Jalen Duren",
      pts: 10,
      final: 19.6,
      line_pts: 14,
    }),
    row({ player_id: 3, name: "Other Team", pro_team_id: 5, final: 30 }),
  ],
};

describe("live line", () => {
  it("keeps one side, biggest finish first", () => {
    expect(sideRows(data, 8).map((r) => r.name)).toEqual([
      "Jalen Duren",
      "Cade Cunningham",
    ]);
  });
  it("shares one scale in whole fives", () => {
    expect(scaleOf(sideRows(data, 8))).toBe(30);
    expect(scaleOf([row({ pts: 0, final: 2, line_pts: 3 })])).toBe(15);
  });
  it("says how a finish stands against his line", () => {
    expect(vsLine(row({}))).toEqual({ text: "−8", dir: "down" });
    expect(vsLine(row({ final: 19.6, line_pts: 14 }))).toEqual({
      text: "+6",
      dir: "up",
    });
    expect(vsLine(row({ final: 25.6, line_pts: 26.2 })).dir).toBe("even");
  });
  it("reads out plainly", () => {
    expect(rowSentence(row({}))).toBe(
      "6 now, ends about 18, −8 against his line of 26.",
    );
    expect(honesty(data)).toBe(
      "At this point half of finals land within 3.1 points of our number; 8 in 10 within 5.5.",
    );
  });
});

describe("live quarters", () => {
  const side = {
    pro_team_id: 8,
    pregame: [28, 28, 28, 27],
    real: [31, 29, 16],
    live: [31, 29, 29.6, 26.4],
  };
  it("reads played, in progress and to come", () => {
    expect(quarterCells(side, 3)).toEqual([
      { kind: "played", value: 31 },
      { kind: "played", value: 29 },
      { kind: "now", value: 30, sofar: 16 },
      { kind: "next", value: 26, was: 27 },
    ]);
    expect(gameCell(side, 3)).toEqual({ ends: 116, now: 76, overtime: false });
  });
  it("keeps the tip-off number out when the score has not moved it", () => {
    expect(quarterCells({ ...side, live: [31, 29, 29.6, 27.2] }, 3)[3]).toEqual(
      { kind: "next", value: 27, was: null },
    );
  });
  it("is all real in overtime", () => {
    const ot = { ...side, real: [31, 29, 25, 22], live: [31, 29, 25, 22] };
    expect(quarterCells(ot, 5).every((c) => c.kind === "played")).toBe(true);
    expect(gameCell(ot, 5)).toEqual({ ends: 107, now: 107, overtime: true });
  });
  it("reads out plainly", () => {
    expect(quarterSentence("Detroit Pistons", side, 3)).toBe(
      "Detroit Pistons: 1st 31; 2nd 29; 3rd 16 so far, about 30 by its end; 4th about 26; about 116 in all.",
    );
  });
});
