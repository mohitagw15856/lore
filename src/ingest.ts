import type { Env } from "./index.ts";
import { ensureChat } from "./db.ts";
import { displayName, extractEmoji, localParts, type TgUser } from "./logic.ts";

export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string; title?: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  reply_to_message?: TgMessage;
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
}

/** Record one group message as counts (and raw text for 30 days). */
export async function ingest(msg: TgMessage, env: Env) {
  const from = msg.from;
  if (!from || from.is_bot) return;
  const text = (msg.text ?? msg.caption ?? "").slice(0, 1000);
  const chat = await ensureChat(env, msg.chat.id, msg.chat.title ?? null, msg.date);
  const { day, hour } = localParts(msg.date, chat.tz_offset_min);
  const night = hour < 5 ? 1 : 0;

  let latency: number | null = null;
  const r = msg.reply_to_message;
  const repliedTo = r?.from && !r.from.is_bot && r.from.id !== from.id ? r.from : null;
  if (repliedTo && r) latency = Math.max(0, msg.date - r.date);

  const stmts = [
    env.DB.prepare(
      `INSERT INTO members (chat_id,user_id,name,msg_count,last_seen) VALUES (?,?,?,1,?)
       ON CONFLICT(chat_id,user_id) DO UPDATE SET name=excluded.name, msg_count=msg_count+1, last_seen=excluded.last_seen`,
    ).bind(chat.chat_id, from.id, displayName(from), msg.date),
    env.DB.prepare(
      `INSERT INTO daily_stats (chat_id,user_id,day,msgs,night_msgs,replies,reply_latency_sum) VALUES (?,?,?,1,?,?,?)
       ON CONFLICT(chat_id,user_id,day) DO UPDATE SET msgs=msgs+1, night_msgs=night_msgs+excluded.night_msgs,
       replies=replies+excluded.replies, reply_latency_sum=reply_latency_sum+excluded.reply_latency_sum`,
    ).bind(chat.chat_id, from.id, day, night, latency === null ? 0 : 1, latency ?? 0),
  ];

  if (text) {
    stmts.push(
      env.DB.prepare("INSERT OR IGNORE INTO messages (chat_id,msg_id,user_id,text,ts) VALUES (?,?,?,?,?)").bind(
        chat.chat_id,
        msg.message_id,
        from.id,
        text,
        msg.date,
      ),
    );
  }

  if (repliedTo) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO daily_stats (chat_id,user_id,day,got_replies) VALUES (?,?,?,1)
         ON CONFLICT(chat_id,user_id,day) DO UPDATE SET got_replies=got_replies+1`,
      ).bind(chat.chat_id, repliedTo.id, day),
    );
  }

  for (const e of extractEmoji(text)) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO emoji_stats (chat_id,user_id,day,emoji,count) VALUES (?,?,?,?,1)
         ON CONFLICT(chat_id,user_id,day,emoji) DO UPDATE SET count=count+1`,
      ).bind(chat.chat_id, from.id, day, e),
    );
  }

  await env.DB.batch(stmts);
}
