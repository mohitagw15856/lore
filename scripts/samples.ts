import type { MemberWrapped, Receipts, Wrapped } from "../src/stats.ts";

export const SAMPLE_RECEIPTS: Receipts = {
  title: "The Usual Suspects",
  from: "2026-10-26",
  to: "2026-11-01",
  total: 1283,
  chattiest: { name: "Priya", value: 412, label: "messages" },
  fastest: { name: "Aman", value: 48, label: "avg reply" },
  ghost: { name: "Sam", value: 2 * 86400 + 4 * 3600, label: "avg reply" },
  nightOwl: { name: "Mo", value: 31, label: "messages after midnight" },
  magnet: { name: "Priya", value: 97, label: "replies received" },
  emoji: { emoji: "💀", count: 38 },
  champ: { name: "Priya", won: 5, played: 7, streak: 4 },
  topChatters: [
    { name: "Priya", msgs: 412 },
    { name: "Mo", msgs: 301 },
    { name: "Aman", msgs: 288 },
  ],
};

export const SAMPLE_WRAPPED: Wrapped = {
  ...SAMPLE_RECEIPTS,
  from: "2026-01-01",
  to: "2026-12-31",
  year: "2026",
  total: 48213,
  busiestDay: { day: "2026-07-14", msgs: 912 },
  emojiDna: [
    { emoji: "💀", count: 1204 },
    { emoji: "😂", count: 988 },
    { emoji: "🔥", count: 402 },
    { emoji: "🫠", count: 377 },
    { emoji: "🥲", count: 203 },
  ],
  mostQuoted: { name: "Mo", quotes: 41 },
  longestStreak: { name: "Priya", streak: 23 },
  capsulesOpened: 3,
  members: 7,
};

export const SAMPLE_MEMBER: MemberWrapped = {
  name: "Mo",
  year: "2026",
  title: "The Usual Suspects",
  msgs: 9802,
  rank: 2,
  of: 7,
  nightMsgs: 1420,
  favEmoji: "🫠",
  quizWon: 180,
  quizPlayed: 221,
  bestStreak: 19,
  quoted: 41,
  persona: "The Night Owl 🦉",
};
