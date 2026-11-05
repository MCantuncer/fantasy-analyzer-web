import { describe, expect, it } from "vitest";
import { shortListNote } from "./tradeList";

describe("shortListNote", () => {
  it("says how many deals passed when the list is short", () => {
    expect(shortListNote(1)).toBe("Only 1 deal does that right now.");
    expect(shortListNote(2)).toBe("Only 2 deals do that right now.");
  });

  it("says nothing for a full or empty list", () => {
    expect(shortListNote(10)).toBe("");
    expect(shortListNote(0)).toBe("");
  });
});
