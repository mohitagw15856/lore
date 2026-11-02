import type { Env } from "./index.ts";

export async function tg<T = any>(env: Env, method: string, body: Record<string, unknown>): Promise<T | null> {
  const base = env.TG_API_BASE ?? "https://api.telegram.org";
  const r = await fetch(`${base}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { ok: boolean; result?: T; description?: string };
  if (!j.ok) {
    console.error(`telegram ${method}: ${j.description}`);
    return null;
  }
  return j.result ?? null;
}

export function send(env: Env, chat_id: number, text: string, extra: Record<string, unknown> = {}) {
  return tg(env, "sendMessage", {
    chat_id,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
