import { describe, expect, it } from "vitest";
import {
  addDays, buildOptions, displayName, extractEmoji, fmtDuration, isQuoteCandidate, isoWeek,
  localParts, nextStreak, parseDate, parseTz, pointsFor, prevDay, shuffleWith,
} from "../src/logic.ts";

describe("isQuoteCandidate", () => {
  it("accepts a normal memorable sentence", () => {
    expect(isQuoteCandidate("honestly the best pizza in town is the one near the station")).toBe(true);
  });
  it("rejects short, long, links, commands, mentions, codes", () => {
    expect(isQuoteCandidate("lol ok")).toBe(false);
    expect(isQuoteCandidate("a".repeat(200))).toBe(false);
    expect(isQuoteCandidate("check this out https://example.com it is great")).toBe(false);
    expect(isQuoteCandidate("/play now please everyone")).toBe(false);
    expect(isQuoteCandidate("@mo are you coming tonight or not")).toBe(false);
    expect(isQuoteCandidate("my otp code is 483920 do not share")).toBe(false);
    expect(isQuoteCandidate("😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂😂")).toBe(false);
  });
});

describe("extractEmoji", () => {
  it("finds emoji including ZWJ sequences and skips digits", () => {
    expect(extractEmoji("great 😂 job 👨‍👩‍👧 #1 💀💀")).toEqual(["😂", "👨‍👩‍👧", "💀", "💀"]);
    expect(extractEmoji("no emoji here 123")).toEqual([]);
  });
});

describe("time helpers", () => {
  it("applies the UTC offset to day and hour", () => {
    // 2026-11-01T23:30Z at +5:30 is 2026-11-02 05:00
    const ts = Date.UTC(2026, 10, 1, 23, 30) / 1000;
    expect(localParts(ts, 330)).toMatchObject({ day: "2026-11-02", hour: 5, weekday: 1, year: 2026 });
    expect(localParts(ts, -480)).toMatchObject({ day: "2026-11-01", hour: 15 });
  });
  it("prevDay / addDays cross month boundaries", () => {
    expect(prevDay("2026-03-01")).toBe("2026-02-28");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("isoWeek matches ISO 8601", () => {
    expect(isoWeek("2026-01-01")).toBe("2026-W01");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
    expect(isoWeek("2026-11-02")).toBe("2026-W45");
  });
  it("parseTz handles signs and minutes", () => {
    expect(parseTz("+5:30")).toBe(330);
    expect(parseTz("-8")).toBe(-480);
    expect(parseTz("0")).toBe(0);
    expect(parseTz("abc")).toBeNull();
    expect(parseTz("+15")).toBeNull();
  });
  it("parseDate rejects impossible dates", () => {
    expect(parseDate("2027-02-29")).toBeNull();
    expect(parseDate("2028-02-29")).toBe("2028-02-29");
    expect(parseDate("tomorrow")).toBeNull();
  });
  it("fmtDuration picks a sensible unit", () => {
    expect(fmtDuration(42)).toBe("42s");
    expect(fmtDuration(600)).toBe("10m");
    expect(fmtDuration(3600 * 5 + 120)).toBe("5h 2m");
    expect(fmtDuration(86400 * 2 + 3600 * 4)).toBe("2d 4h");
  });
});

describe("game mechanics", () => {
  it("shuffle is deterministic for a fixed rng and keeps all items", () => {
    const a = shuffleWith([1, 2, 3, 4], () => 0.5);
    expect(a.sort()).toEqual([1, 2, 3, 4]);
  });
  it("buildOptions always includes the correct answer at the reported index", () => {
    for (let i = 0; i < 50; i++) {
      const { options, correctIdx } = buildOptions("Mo", ["Priya", "Sam", "Aman", "Extra"]);
      expect(options).toHaveLength(4);
      expect(options[correctIdx]).toBe("Mo");
    }
  });
  it("streaks continue only across consecutive game days", () => {
    expect(nextStreak(3, "2026-11-01", "2026-11-02", true)).toBe(4);
    expect(nextStreak(3, "2026-10-30", "2026-11-02", true)).toBe(1);
    expect(nextStreak(3, "2026-11-01", "2026-11-02", false)).toBe(0);
    expect(nextStreak(0, null, "2026-11-02", true)).toBe(1);
  });
  it("points reward streaks but cap the bonus", () => {
    expect(pointsFor(false, 0)).toBe(0);
    expect(pointsFor(true, 1)).toBe(10);
    expect(pointsFor(true, 3)).toBe(12);
    expect(pointsFor(true, 40)).toBe(15);
  });
  it("displayName falls back gracefully", () => {
    expect(displayName({ id: 1, first_name: "Mo", last_name: "A" })).toBe("Mo A");
    expect(displayName({ id: 1, first_name: "", username: "mo" })).toBe("mo");
    expect(displayName({ id: 7, first_name: "" })).toBe("user7");
  });
});
