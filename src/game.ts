import type { Env } from "./index.ts";
import { getChat } from "./db.ts";
import { esc, send, tg } from "./telegram.ts";
import { buildOptions, isQuoteCandidate, localParts, medal, nextStreak, pointsFor } from "./logic.ts";

interface Candidate { msg_id: number; user_id: number; text: string; name: string }

/** Post today's "Who said it?" quiz. Returns false when the group is too quiet to play. */
export async function postGame(env: Env, chatId: number, now: number): Promise<boolean> {
  const chat = await getChat(env, chatId);
  if (!chat) return false;

  const members = await env.DB.prepare(
    "SELECT user_id, name FROM members WHERE chat_id=? AND msg_count>=1 ORDER BY RANDOM() LIMIT 40",
  ).bind(chatId).all<{ user_id: number; name: string }>();
  if (members.results.length < 4) {
    await send(env, chatId, "🧠 I need at least <b>4 chatty humans</b> before Who Said It works. Keep talking, I'm listening (and counting).");
    return false;
  }

  const rows = await env.DB.prepare(
    `SELECT m.msg_id, m.user_id, m.text, mem.name FROM messages m
     JOIN members mem ON mem.chat_id=m.chat_id AND mem.user_id=m.user_id
     WHERE m.chat_id=? AND m.quoted=0 AND length(m.text) BETWEEN 20 AND 180 AND mem.msg_count>=3
     ORDER BY RANDOM() LIMIT 30`,
  ).bind(chatId).all<Candidate>();
  const pick = rows.results.find((r) => isQuoteCandidate(r.text));
  if (!pick) {
    await send(env, chatId, "🫥 Not enough quotable material yet. Say something memorable and try /play tomorrow.");
    return false;
  }

  const others = members.results.filter((m) => m.user_id !== pick.user_id).slice(0, 3).map((m) => m.name);
  const { options, correctIdx } = buildOptions(pick.name, others);

  // Close yesterday's poll so answers stop trickling in.
  const open = await env.DB.prepare("SELECT message_id FROM games WHERE chat_id=? AND closed=0").bind(chatId).all<{ message_id: number }>();
  for (const g of open.results) await tg(env, "stopPoll", { chat_id: chatId, message_id: g.message_id });
  await env.DB.prepare("UPDATE games SET closed=1 WHERE chat_id=? AND closed=0").bind(chatId).run();

  const { day } = localParts(now, chat.tz_offset_min);
  const quote = await env.DB.prepare(
    "INSERT INTO quotes (chat_id,msg_id,user_id,text,used_at) VALUES (?,?,?,?,?) RETURNING id",
  ).bind(chatId, pick.msg_id, pick.user_id, pick.text, now).first<{ id: number }>();
  await env.DB.prepare("UPDATE messages SET quoted=1 WHERE chat_id=? AND msg_id=?").bind(chatId, pick.msg_id).run();

  const sent = await tg<{ message_id: number; poll: { id: string } }>(env, "sendPoll", {
    chat_id: chatId,
    question: `🧠 Who said it?\n\n“${pick.text.slice(0, 240)}”`,
    options,
    type: "quiz",
    correct_option_id: correctIdx,
    is_anonymous: false,
    explanation: "Lore remembers everything. /leaderboard for the standings.",
  });
  if (!sent) return false;

  await env.DB.prepare(
    "INSERT INTO games (poll_id,chat_id,message_id,quote_id,correct_idx,options,day,posted_at) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(sent.poll.id, chatId, sent.message_id, quote!.id, correctIdx, JSON.stringify(options), day, now).run();
  return true;
}

export interface PollAnswer { poll_id: string; user: { id: number; first_name: string; last_name?: string; username?: string }; option_ids: number[] }

export async function handleAnswer(ans: PollAnswer, env: Env, now: number) {
  if (!ans.option_ids.length) return; // retracted vote
  const game = await env.DB.prepare("SELECT chat_id, correct_idx, day FROM games WHERE poll_id=?")
    .bind(ans.poll_id).first<{ chat_id: number; correct_idx: number; day: string }>();
  if (!game) return;
  const correct = ans.option_ids[0] === game.correct_idx;

  const ins = await env.DB.prepare("INSERT OR IGNORE INTO answers (poll_id,user_id,correct,ts) VALUES (?,?,?,?)")
    .bind(ans.poll_id, ans.user.id, correct ? 1 : 0, now).run();
  if (!ins.meta.changes) return; // already answered

  const s = await env.DB.prepare("SELECT streak, best_streak, last_day FROM scores WHERE chat_id=? AND user_id=?")
    .bind(game.chat_id, ans.user.id).first<{ streak: number; best_streak: number; last_day: string | null }>();
  const streak = nextStreak(s?.streak ?? 0, s?.last_day ?? null, game.day, correct);
  const pts = pointsFor(correct, streak);
  await env.DB.prepare(
    `INSERT INTO scores (chat_id,user_id,points,streak,best_streak,played,won,last_day) VALUES (?,?,?,?,?,1,?,?)
     ON CONFLICT(chat_id,user_id) DO UPDATE SET points=points+excluded.points, streak=excluded.streak,
     best_streak=MAX(best_streak, excluded.best_streak), played=played+1, won=won+excluded.won, last_day=excluded.last_day`,
  ).bind(game.chat_id, ans.user.id, pts, streak, Math.max(streak, s?.best_streak ?? 0), correct ? 1 : 0, game.day).run();
}

export async function leaderboardText(env: Env, chatId: number): Promise<string> {
  const rows = await env.DB.prepare(
    `SELECT s.points, s.streak, s.best_streak, s.played, s.won, m.name FROM scores s
     JOIN members m ON m.chat_id=s.chat_id AND m.user_id=s.user_id
     WHERE s.chat_id=? ORDER BY s.points DESC, s.won DESC LIMIT 10`,
  ).bind(chatId).all<{ points: number; streak: number; best_streak: number; played: number; won: number; name: string }>();
  if (!rows.results.length) return "🏆 Nobody has played yet. /play to start.";
  const lines = rows.results.map((r, i) => {
    const fire = r.streak >= 2 ? ` 🔥${r.streak}` : "";
    return `${medal(i)} <b>${esc(r.name)}</b> · ${r.points} pts · ${r.won}/${r.played}${fire}`;
  });
  return `🏆 <b>Who Said It · Leaderboard</b>\n\n${lines.join("\n")}`;
}
