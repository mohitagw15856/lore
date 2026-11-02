import type { Env } from "./index.ts";
import { ensureChat, forgetUser, getChat, getSetting, purgeChat } from "./db.ts";
import { ingest, type TgMessage } from "./ingest.ts";
import { handleAnswer, leaderboardText, postGame, type PollAnswer } from "./game.ts";
import { capsuleInGroup, capsuleStart, capsuleStep } from "./capsule.ts";
import { computeReceipts, computeWrapped } from "./stats.ts";
import { HELP, PRIVACY, receiptsText, welcomeText, wrappedText } from "./format.ts";
import { esc, send } from "./telegram.ts";
import { addDays, localParts, parseTz, type TgUser } from "./logic.ts";

interface ChatMemberUpdate { chat: { id: number; type: string; title?: string }; new_chat_member: { status: string; user: TgUser }; date: number }
export interface Update { update_id: number; message?: TgMessage; poll_answer?: PollAnswer; my_chat_member?: ChatMemberUpdate }

const isGroup = (t: string) => t === "group" || t === "supergroup";

export async function handleUpdate(u: Update, env: Env, now: number) {
  if (u.my_chat_member) return onMembership(u.my_chat_member, env, now);
  if (u.poll_answer) return handleAnswer(u.poll_answer, env, now);
  const m = u.message;
  if (!m || !m.from || m.from.is_bot) return;
  const text = m.text ?? "";
  if (m.chat.type === "private") return onPrivate(m, text, env, now);
  if (!isGroup(m.chat.type)) return;
  if (text.startsWith("/")) return onGroupCommand(m, text, env, now);
  return ingest(m, env);
}

async function onMembership(cm: ChatMemberUpdate, env: Env, now: number) {
  if (!isGroup(cm.chat.type)) return;
  const status = cm.new_chat_member.status;
  if (status === "member" || status === "administrator") {
    const existed = await getChat(env, cm.chat.id);
    await ensureChat(env, cm.chat.id, cm.chat.title ?? null, now);
    if (!existed) await send(env, cm.chat.id, welcomeText(env.BOT_NAME));
  } else if (status === "left" || status === "kicked") {
    await purgeChat(env, cm.chat.id); // removed = forgotten
  }
}

async function onPrivate(m: TgMessage, text: string, env: Env, now: number) {
  const user = m.from!;
  if (text.startsWith("/start")) {
    const arg = text.split(/\s+/)[1] ?? "";
    const cap = /^capsule_(-?\d+)$/.exec(arg);
    if (cap) return capsuleStart(env, user, Number(cap[1]), now);
    return send(env, user.id, `${HELP}\n\nAdd me to a group: t.me/${env.BOT_NAME}?startgroup=true`);
  }
  if (text === "/help") return send(env, user.id, HELP);
  if (text === "/privacy") return send(env, user.id, PRIVACY);
  if (text === "/forgetme") {
    await forgetUser(env, user.id, null);
    return send(env, user.id, "🗑 Done. Everything about you, in every group, is gone.");
  }
  if (await capsuleStep(env, user, text, now)) return;
  return send(env, user.id, "I work in groups. Add me to one: t.me/" + env.BOT_NAME + "?startgroup=true\n\n/help for commands.");
}

async function onGroupCommand(m: TgMessage, text: string, env: Env, now: number) {
  const chatId = m.chat.id;
  const [raw, ...args] = text.split(/\s+/);
  const cmd = raw.split("@")[0].toLowerCase();
  const chat = await ensureChat(env, chatId, m.chat.title ?? null, now);
  const origin = await getSetting(env, "origin");
  const card = (path: string) => (origin ? `${origin}/c/${chat.token}/${path}` : null);

  switch (cmd) {
    case "/start":
    case "/help":
      return send(env, chatId, HELP);
    case "/privacy":
      return send(env, chatId, PRIVACY);
    case "/play":
      return postGame(env, chatId, now);
    case "/leaderboard":
      return send(env, chatId, await leaderboardText(env, chatId));
    case "/receipts": {
      const { day } = localParts(now, chat.tz_offset_min);
      return send(env, chatId, receiptsText(await computeReceipts(env, chatId, addDays(day, -6), day), card("receipts")));
    }
    case "/wrapped": {
      const { year } = localParts(now, chat.tz_offset_min);
      const y = /^\d{4}$/.test(args[0] ?? "") ? args[0] : String(year);
      return send(env, chatId, wrappedText(await computeWrapped(env, chatId, y), card(`wrapped/${y}`)));
    }
    case "/me": {
      const { year } = localParts(now, chat.tz_offset_min);
      const url = card(`me/${m.from!.id}/${year}`);
      return send(env, chatId, url ? `🎁 Your ${year} card, ${esc(m.from!.first_name)}: ${url}` : "Cards aren't set up on this deployment yet.");
    }
    case "/capsule":
      return capsuleInGroup(env, chatId);
    case "/settime": {
      const hr = Number(args[0]);
      if (!Number.isInteger(hr) || hr < 0 || hr > 23) return send(env, chatId, "Usage: /settime 9 (an hour from 0 to 23, local time)");
      await env.DB.prepare("UPDATE chats SET game_hour=? WHERE chat_id=?").bind(hr, chatId).run();
      return send(env, chatId, `⏰ Daily quiz now posts at <b>${String(hr).padStart(2, "0")}:00</b> local.`);
    }
    case "/timezone": {
      const off = parseTz(args[0] ?? "");
      if (off === null) return send(env, chatId, "Usage: /timezone +5:30 or /timezone -8");
      await env.DB.prepare("UPDATE chats SET tz_offset_min=? WHERE chat_id=?").bind(off, chatId).run();
      return send(env, chatId, `🌍 Timezone set to UTC${off >= 0 ? "+" : "-"}${Math.floor(Math.abs(off) / 60)}:${String(Math.abs(off) % 60).padStart(2, "0")}.`);
    }
    case "/pause":
      await env.DB.prepare("UPDATE chats SET paused=1 WHERE chat_id=?").bind(chatId).run();
      return send(env, chatId, "⏸ Paused. I'll keep counting quietly. /resume when you're ready.");
    case "/resume":
      await env.DB.prepare("UPDATE chats SET paused=0 WHERE chat_id=?").bind(chatId).run();
      return send(env, chatId, "▶️ Back on. Daily quiz resumes tomorrow.");
    case "/forgetme":
      await forgetUser(env, m.from!.id, chatId);
      return send(env, chatId, `🗑 ${esc(m.from!.first_name)}, everything about you in this group is gone.`);
    default:
      return; // unknown command, stay quiet
  }
}
