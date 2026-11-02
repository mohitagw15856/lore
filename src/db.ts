import type { Env } from "./index.ts";
import { randomToken } from "./logic.ts";

export interface ChatRow {
  chat_id: number;
  title: string | null;
  token: string;
  tz_offset_min: number;
  game_hour: number;
  paused: number;
  installed_at: number;
  last_game_day: string | null;
  last_receipts_week: string | null;
  last_wrapped_year: string | null;
}

export async function getChat(env: Env, chatId: number): Promise<ChatRow | null> {
  return env.DB.prepare("SELECT * FROM chats WHERE chat_id=?").bind(chatId).first<ChatRow>();
}

export async function getChatByToken(env: Env, token: string): Promise<ChatRow | null> {
  return env.DB.prepare("SELECT * FROM chats WHERE token=?").bind(token).first<ChatRow>();
}

export async function ensureChat(env: Env, chatId: number, title: string | null, now: number): Promise<ChatRow> {
  const existing = await getChat(env, chatId);
  if (existing) {
    if (title && title !== existing.title) {
      await env.DB.prepare("UPDATE chats SET title=? WHERE chat_id=?").bind(title, chatId).run();
      existing.title = title;
    }
    return existing;
  }
  const token = randomToken();
  await env.DB.prepare("INSERT INTO chats (chat_id, title, token, installed_at) VALUES (?,?,?,?)")
    .bind(chatId, title, token, now)
    .run();
  return (await getChat(env, chatId))!;
}

export async function setSetting(env: Env, key: string, value: string) {
  await env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, value)
    .run();
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first<{ value: string }>();
  return r?.value ?? null;
}

/** Everything about a chat, gone. Called when the bot is removed from a group. */
export async function purgeChat(env: Env, chatId: number) {
  const tables = ["messages", "members", "daily_stats", "emoji_stats", "quotes", "games", "scores", "capsules", "chats"];
  await env.DB.batch(tables.map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE chat_id=?`).bind(chatId)));
  await env.DB.prepare("DELETE FROM answers WHERE poll_id NOT IN (SELECT poll_id FROM games)").run();
}

/** Everything about one person in one chat (or all chats when chatId is null). */
export async function forgetUser(env: Env, userId: number, chatId: number | null) {
  const where = chatId === null ? "user_id=?" : "user_id=? AND chat_id=?";
  const bind = chatId === null ? [userId] : [userId, chatId];
  const tables = ["messages", "members", "daily_stats", "emoji_stats", "quotes", "scores", "capsules"];
  await env.DB.batch(tables.map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE ${where}`).bind(...bind)));
  await env.DB.prepare("DELETE FROM answers WHERE user_id=?").bind(userId).run();
}
