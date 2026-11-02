import type { Env } from "./index.ts";
import type { ChatRow } from "./db.ts";
import { getSetting } from "./db.ts";
import { postGame } from "./game.ts";
import { deliverCapsules } from "./capsule.ts";
import { computeReceipts, computeWrapped } from "./stats.ts";
import { receiptsText, wrappedText } from "./format.ts";
import { send } from "./telegram.ts";
import { DAY_SEC, addDays, isoWeek, localParts } from "./logic.ts";

/** Runs hourly. Each group gets its posts at its own local hour. */
export async function runCron(env: Env, now: number) {
  const origin = await getSetting(env, "origin");
  const chats = await env.DB.prepare("SELECT * FROM chats WHERE paused=0").all<ChatRow>();
  for (const c of chats.results) {
    try {
      await tick(env, c, now, origin);
    } catch (e) {
      console.error(`chat ${c.chat_id}:`, e);
    }
  }
  await deliverCapsules(env, now);
  await env.DB.prepare("DELETE FROM messages WHERE ts<?").bind(now - 30 * DAY_SEC).run();
  await env.DB.prepare("DELETE FROM dm_state WHERE updated_at<?").bind(now - DAY_SEC).run();
}

async function tick(env: Env, c: ChatRow, now: number, origin: string | null) {
  const { day, hour, weekday, year } = localParts(now, c.tz_offset_min);
  if (hour !== c.game_hour) return;
  const card = (p: string) => (origin ? `${origin}/c/${c.token}/${p}` : null);

  const week = isoWeek(day);
  if (weekday === 1 && c.last_receipts_week !== week) {
    const r = await computeReceipts(env, c.chat_id, addDays(day, -7), addDays(day, -1));
    if (r.total > 0) await send(env, c.chat_id, receiptsText(r, card("receipts")));
    await env.DB.prepare("UPDATE chats SET last_receipts_week=? WHERE chat_id=?").bind(week, c.chat_id).run();
  }

  if (day.endsWith("-12-31") && c.last_wrapped_year !== String(year)) {
    const w = await computeWrapped(env, c.chat_id, String(year));
    if (w.total > 0) await send(env, c.chat_id, wrappedText(w, card(`wrapped/${year}`)) + "\n\nSend /me for your personal card.");
    await env.DB.prepare("UPDATE chats SET last_wrapped_year=? WHERE chat_id=?").bind(String(year), c.chat_id).run();
  }

  if (c.last_game_day !== day) {
    await env.DB.prepare("UPDATE chats SET last_game_day=? WHERE chat_id=?").bind(day, c.chat_id).run();
    await postGame(env, c.chat_id, now);
  }
}
