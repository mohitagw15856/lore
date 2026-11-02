import { handleUpdate, type Update } from "./bot.ts";
import { runCron } from "./cron.ts";
import { cardRoute, renderIndex } from "./cards.ts";
import { setSetting } from "./db.ts";
import { tg } from "./telegram.ts";

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  BOT_NAME: string;
  /** Optional. Point at a local Bot API server or a mock. */
  TG_API_BASE?: string;
}

const COMMANDS = [
  ["play", "Post a Who Said It quiz now"],
  ["leaderboard", "Quiz standings"],
  ["receipts", "This week's stats"],
  ["wrapped", "The year so far"],
  ["me", "Your personal Wrapped card"],
  ["capsule", "Seal a time capsule"],
  ["settime", "Hour the daily quiz posts"],
  ["timezone", "Set the group's UTC offset"],
  ["pause", "Stop daily posts"],
  ["resume", "Restart daily posts"],
  ["privacy", "What is stored, for how long"],
  ["forgetme", "Delete everything about you"],
  ["help", "All commands"],
].map(([command, description]) => ({ command, description }));

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const now = Math.floor(Date.now() / 1000);

    if (req.method === "POST" && url.pathname === "/webhook") {
      if (req.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
      const update = (await req.json()) as Update;
      ctx.waitUntil(handleUpdate(update, env, now).catch((e) => console.error("update", update.update_id, e)));
      return new Response("ok");
    }

    // One-time: GET /setup?secret=<WEBHOOK_SECRET> registers the webhook + command menu.
    if (url.pathname === "/setup") {
      if (url.searchParams.get("secret") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
      await setSetting(env, "origin", url.origin);
      const ok = await tg(env, "setWebhook", {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message", "poll_answer", "my_chat_member"],
        drop_pending_updates: true,
      });
      await tg(env, "setMyCommands", { commands: COMMANDS });
      const me = await tg<{ username: string }>(env, "getMe", {});
      return new Response(
        ok
          ? `✅ Webhook set for @${me?.username ?? env.BOT_NAME}.\nNow add the bot to a group: https://t.me/${me?.username ?? env.BOT_NAME}?startgroup=true\n\nReminder: disable privacy mode in @BotFather (/setprivacy → Disable) so the bot can read group messages.`
          : "❌ setWebhook failed. Check BOT_TOKEN.",
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    if (url.pathname.startsWith("/c/")) return cardRoute(url, env, now);
    if (url.pathname === "/") return new Response(renderIndex(env.BOT_NAME), { headers: { "content-type": "text/html; charset=utf-8" } });
    if (url.pathname === "/health") return new Response("ok");
    return new Response("not found", { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCron(env, Math.floor(event.scheduledTime / 1000)));
  },
} satisfies ExportedHandler<Env>;
