import type { Env } from "./index.ts";

export interface Superlative { name: string; value: number; label: string }
export interface Receipts {
  title: string;
  from: string;
  to: string;
  total: number;
  chattiest: Superlative | null;
  fastest: Superlative | null;
  ghost: Superlative | null;
  nightOwl: Superlative | null;
  magnet: Superlative | null;
  emoji: { emoji: string; count: number } | null;
  champ: { name: string; won: number; played: number; streak: number } | null;
  topChatters: { name: string; msgs: number }[];
}

interface Agg { user_id: number; name: string; msgs: number; night_msgs: number; replies: number; reply_latency_sum: number; got_replies: number }

/** Shared aggregation for Receipts (a week) and Wrapped (a year). */
export async function computeReceipts(env: Env, chatId: number, from: string, to: string): Promise<Receipts> {
  const chat = await env.DB.prepare("SELECT title FROM chats WHERE chat_id=?").bind(chatId).first<{ title: string | null }>();
  const agg = await env.DB.prepare(
    `SELECT d.user_id, m.name, SUM(d.msgs) msgs, SUM(d.night_msgs) night_msgs, SUM(d.replies) replies,
            SUM(d.reply_latency_sum) reply_latency_sum, SUM(d.got_replies) got_replies
     FROM daily_stats d JOIN members m ON m.chat_id=d.chat_id AND m.user_id=d.user_id
     WHERE d.chat_id=? AND d.day BETWEEN ? AND ? GROUP BY d.user_id ORDER BY msgs DESC`,
  ).bind(chatId, from, to).all<Agg>();
  const rows = agg.results;
  const total = rows.reduce((a, r) => a + r.msgs, 0);

  const top = (key: (r: Agg) => number, label: string, min = 1): Superlative | null => {
    const best = rows.filter((r) => key(r) >= min).sort((a, b) => key(b) - key(a))[0];
    return best ? { name: best.name, value: key(best), label } : null;
  };
  const avgLatency = (r: Agg) => (r.replies >= 3 ? r.reply_latency_sum / r.replies : NaN);
  const withLatency = rows.filter((r) => !isNaN(avgLatency(r)));
  const fastestRow = withLatency.sort((a, b) => avgLatency(a) - avgLatency(b))[0];
  const ghostRow = withLatency.slice().sort((a, b) => avgLatency(b) - avgLatency(a))[0];

  const emoji = await env.DB.prepare(
    "SELECT emoji, SUM(count) count FROM emoji_stats WHERE chat_id=? AND day BETWEEN ? AND ? GROUP BY emoji ORDER BY count DESC LIMIT 1",
  ).bind(chatId, from, to).first<{ emoji: string; count: number }>();

  const champ = await env.DB.prepare(
    `SELECT m.name, SUM(a.correct) won, COUNT(*) played, COALESCE(s.streak,0) streak
     FROM answers a JOIN games g ON g.poll_id=a.poll_id
     JOIN members m ON m.chat_id=g.chat_id AND m.user_id=a.user_id
     LEFT JOIN scores s ON s.chat_id=g.chat_id AND s.user_id=a.user_id
     WHERE g.chat_id=? AND g.day BETWEEN ? AND ? GROUP BY a.user_id ORDER BY won DESC, played ASC LIMIT 1`,
  ).bind(chatId, from, to).first<{ name: string; won: number; played: number; streak: number }>();

  return {
    title: chat?.title ?? "this group",
    from,
    to,
    total,
    chattiest: top((r) => r.msgs, "messages"),
    fastest: fastestRow ? { name: fastestRow.name, value: Math.round(avgLatency(fastestRow)), label: "avg reply" } : null,
    ghost: ghostRow && ghostRow !== fastestRow ? { name: ghostRow.name, value: Math.round(avgLatency(ghostRow)), label: "avg reply" } : null,
    nightOwl: top((r) => r.night_msgs, "messages after midnight", 3),
    magnet: top((r) => r.got_replies, "replies received", 3),
    emoji: emoji && emoji.count > 0 ? emoji : null,
    champ: champ && champ.played > 0 ? champ : null,
    topChatters: rows.slice(0, 5).map((r) => ({ name: r.name, msgs: r.msgs })),
  };
}

export interface Wrapped extends Receipts {
  year: string;
  busiestDay: { day: string; msgs: number } | null;
  emojiDna: { emoji: string; count: number }[];
  mostQuoted: { name: string; quotes: number } | null;
  longestStreak: { name: string; streak: number } | null;
  capsulesOpened: number;
  members: number;
}

export async function computeWrapped(env: Env, chatId: number, year: string): Promise<Wrapped> {
  const base = await computeReceipts(env, chatId, `${year}-01-01`, `${year}-12-31`);
  const busiest = await env.DB.prepare(
    "SELECT day, SUM(msgs) msgs FROM daily_stats WHERE chat_id=? AND day LIKE ? GROUP BY day ORDER BY msgs DESC LIMIT 1",
  ).bind(chatId, `${year}-%`).first<{ day: string; msgs: number }>();
  const dna = await env.DB.prepare(
    "SELECT emoji, SUM(count) count FROM emoji_stats WHERE chat_id=? AND day LIKE ? GROUP BY emoji ORDER BY count DESC LIMIT 5",
  ).bind(chatId, `${year}-%`).all<{ emoji: string; count: number }>();
  const quoted = await env.DB.prepare(
    `SELECT m.name, COUNT(*) quotes FROM quotes q JOIN members m ON m.chat_id=q.chat_id AND m.user_id=q.user_id
     WHERE q.chat_id=? GROUP BY q.user_id ORDER BY quotes DESC LIMIT 1`,
  ).bind(chatId).first<{ name: string; quotes: number }>();
  const streak = await env.DB.prepare(
    "SELECT m.name, s.best_streak streak FROM scores s JOIN members m ON m.chat_id=s.chat_id AND m.user_id=s.user_id WHERE s.chat_id=? ORDER BY s.best_streak DESC LIMIT 1",
  ).bind(chatId).first<{ name: string; streak: number }>();
  const caps = await env.DB.prepare("SELECT COUNT(*) n FROM capsules WHERE chat_id=? AND delivered=1").bind(chatId).first<{ n: number }>();
  const mem = await env.DB.prepare("SELECT COUNT(*) n FROM members WHERE chat_id=?").bind(chatId).first<{ n: number }>();
  return {
    ...base,
    year,
    busiestDay: busiest && busiest.msgs > 0 ? busiest : null,
    emojiDna: dna.results,
    mostQuoted: quoted ?? null,
    longestStreak: streak && streak.streak > 0 ? streak : null,
    capsulesOpened: caps?.n ?? 0,
    members: mem?.n ?? 0,
  };
}

export interface MemberWrapped {
  name: string;
  year: string;
  title: string;
  msgs: number;
  rank: number;
  of: number;
  nightMsgs: number;
  favEmoji: string | null;
  quizWon: number;
  quizPlayed: number;
  bestStreak: number;
  quoted: number;
  persona: string;
}

export function personaFor(m: Omit<MemberWrapped, "persona">): string {
  if (m.msgs === 0) return "The Lurker 👀";
  if (m.rank === 1) return "The Main Character 🎬";
  if (m.nightMsgs / Math.max(1, m.msgs) > 0.25) return "The Night Owl 🦉";
  if (m.quizPlayed >= 5 && m.quizWon / m.quizPlayed >= 0.8) return "The Historian 📜";
  if (m.quoted >= 3) return "The Quotable One 🎤";
  if (m.rank <= 3) return "The Engine Room ⚙️";
  return "The Vibe Keeper ✨";
}

export async function computeMember(env: Env, chatId: number, userId: number, year: string): Promise<MemberWrapped | null> {
  const chat = await env.DB.prepare("SELECT title FROM chats WHERE chat_id=?").bind(chatId).first<{ title: string | null }>();
  const ranks = await env.DB.prepare(
    "SELECT user_id, SUM(msgs) msgs, SUM(night_msgs) night FROM daily_stats WHERE chat_id=? AND day LIKE ? GROUP BY user_id ORDER BY msgs DESC",
  ).bind(chatId, `${year}-%`).all<{ user_id: number; msgs: number; night: number }>();
  const idx = ranks.results.findIndex((r) => r.user_id === userId);
  const me = ranks.results[idx];
  const member = await env.DB.prepare("SELECT name FROM members WHERE chat_id=? AND user_id=?").bind(chatId, userId).first<{ name: string }>();
  if (!member) return null;
  const emoji = await env.DB.prepare(
    "SELECT emoji FROM emoji_stats WHERE chat_id=? AND user_id=? AND day LIKE ? GROUP BY emoji ORDER BY SUM(count) DESC LIMIT 1",
  ).bind(chatId, userId, `${year}-%`).first<{ emoji: string }>();
  const score = await env.DB.prepare("SELECT won, played, best_streak FROM scores WHERE chat_id=? AND user_id=?")
    .bind(chatId, userId).first<{ won: number; played: number; best_streak: number }>();
  const quoted = await env.DB.prepare("SELECT COUNT(*) n FROM quotes WHERE chat_id=? AND user_id=?").bind(chatId, userId).first<{ n: number }>();
  const base = {
    name: member.name,
    year,
    title: chat?.title ?? "this group",
    msgs: me?.msgs ?? 0,
    rank: idx >= 0 ? idx + 1 : ranks.results.length + 1,
    of: ranks.results.length,
    nightMsgs: me?.night ?? 0,
    favEmoji: emoji?.emoji ?? null,
    quizWon: score?.won ?? 0,
    quizPlayed: score?.played ?? 0,
    bestStreak: score?.best_streak ?? 0,
    quoted: quoted?.n ?? 0,
  };
  return { ...base, persona: personaFor(base) };
}
