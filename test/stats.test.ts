import { describe, expect, it } from "vitest";
import { personaFor } from "../src/stats.ts";
import { renderMemberCard, renderReceiptsCard, renderWrappedCard } from "../src/cards.ts";
import { SAMPLE_MEMBER, SAMPLE_RECEIPTS, SAMPLE_WRAPPED } from "../scripts/samples.ts";

describe("personaFor", () => {
  const base = { name: "x", year: "2026", title: "t", msgs: 100, rank: 5, of: 8, nightMsgs: 0, favEmoji: null, quizWon: 0, quizPlayed: 0, bestStreak: 0, quoted: 0 };
  it("assigns personas by priority", () => {
    expect(personaFor({ ...base, msgs: 0 })).toMatch(/Lurker/);
    expect(personaFor({ ...base, rank: 1 })).toMatch(/Main Character/);
    expect(personaFor({ ...base, nightMsgs: 40 })).toMatch(/Night Owl/);
    expect(personaFor({ ...base, quizPlayed: 10, quizWon: 9 })).toMatch(/Historian/);
    expect(personaFor({ ...base, quoted: 4 })).toMatch(/Quotable/);
    expect(personaFor({ ...base, rank: 2 })).toMatch(/Engine Room/);
    expect(personaFor(base)).toMatch(/Vibe Keeper/);
  });
});

describe("cards", () => {
  it("escape user content", () => {
    const html = renderMemberCard({ ...SAMPLE_MEMBER, name: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
  it("render every sample without throwing and include the share button", () => {
    for (const html of [renderReceiptsCard(SAMPLE_RECEIPTS), renderWrappedCard(SAMPLE_WRAPPED), renderMemberCard(SAMPLE_MEMBER)]) {
      expect(html).toContain('id="share"');
      expect(html).toContain("<!doctype html>");
    }
  });
});
