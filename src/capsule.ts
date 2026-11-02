import type { Env } from "./index.ts";
import { esc, send } from "./telegram.ts";
import { parseDate, type TgUser } from "./logic.ts";

interface State { step: "date" | "text"; chat_id: number; unlock_day?: string }

async function setState(env: Env, userId: number, s: State | null, now: number) {
  if (!s) return env.DB.prepare("DELETE FROM dm_state WHERE user_id=?").bind(userId).run();
  return env.DB.prepare(
    "INSERT INTO dm_state (user_id,step,data,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET step=excluded.step, data=excluded.data, updated_at=excluded.updated_at",
  ).bind(userId, s.step, JSON.stringify(s), now).run();
}

async function getState(env: Env, userId: number): Promise<State | null> {
  const r = await env.DB.prepare("SELECT data FROM dm_state WHERE user_id=?").bind(userId).first<{ data: string }>();
  return r ? (JSON.parse(r.data) as State) : null;
}

/** /capsule in a group: hand the user a deep link into DM. */
export async function capsuleInGroup(env: Env, chatId: number) {
  await send(env, chatId, `⏳ Time capsules are sealed in private. Tap: t.me/${env.BOT_NAME}?start=capsule_${encodeURIComponent(String(chatId))}`);
}

/** /start capsule_<chat_id> in DM. */
export async function capsuleStart(env: Env, user: TgUser, chatId: number, now: number) {
  const member = await env.DB.prepare("SELECT 1 FROM members WHERE chat_id=? AND user_id=?").bind(chatId, user.id).first();
  if (!member) {
    await send(env, user.id, "I haven't seen you post in that group yet, so I can't seal a capsule for it. Say hi there first.");
    return;
  }
  await setState(env, user.id, { step: "date", chat_id: chatId }, now);
  await send(env, user.id, "⏳ When should it open? Send a date like <b>2027-01-01</b>.");
}

/** Any non-command DM text while a capsule flow is active. Returns true if consumed. */
export async function capsuleStep(env: Env, user: TgUser, text: string, now: number): Promise<boolean> {
  const s = await getState(env, user.id);
  if (!s) return false;
  if (text === "/cancel") {
    await setState(env, user.id, null, now);
    await send(env, user.id, "Cancelled. Nothing sealed.");
    return true;
  }
  if (s.step === "date") {
    const day = parseDate(text);
    const today = new Date(now * 1000).toISOString().slice(0, 10);
    if (!day || day <= today) {
      await send(env, user.id, "I need a future date in YYYY-MM-DD form, like <b>2027-06-01</b>. Or /cancel.");
      return true;
    }
    await setState(env, user.id, { ...s, step: "text", unlock_day: day }, now);
    await send(env, user.id, `📅 Opens on <b>${day}</b>. Now send the message. It can be anything. Nobody sees it until then.`);
    return true;
  }
  const unlockAt = Math.floor(new Date(`${s.unlock_day}T09:00:00Z`).getTime() / 1000);
  await env.DB.prepare("INSERT INTO capsules (chat_id,user_id,text,unlock_at,created_at) VALUES (?,?,?,?,?)")
    .bind(s.chat_id, user.id, text.slice(0, 2000), unlockAt, now).run();
  await setState(env, user.id, null, now);
  await send(env, user.id, `🔒 Sealed. It opens in the group on <b>${s.unlock_day}</b>. I'll say it was from you.`);
  return true;
}

export async function deliverCapsules(env: Env, now: number) {
  const due = await env.DB.prepare(
    `SELECT c.id, c.chat_id, c.text, c.created_at, m.name FROM capsules c
     LEFT JOIN members m ON m.chat_id=c.chat_id AND m.user_id=c.user_id
     WHERE c.delivered=0 AND c.unlock_at<=? LIMIT 50`,
  ).bind(now).all<{ id: number; chat_id: number; text: string; created_at: number; name: string | null }>();
  for (const c of due.results) {
    const sealed = new Date(c.created_at * 1000).toISOString().slice(0, 10);
    await send(env, c.chat_id, `⏳ <b>A time capsule just opened.</b>\nSealed by <b>${esc(c.name ?? "someone who left")}</b> on ${sealed}:\n\n${esc(c.text)}`);
    await env.DB.prepare("UPDATE capsules SET delivered=1 WHERE id=?").bind(c.id).run();
  }
}
