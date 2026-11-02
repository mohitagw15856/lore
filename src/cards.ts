// Shareable HTML cards. Pure renderers (used by scripts/render-samples.ts too) plus the route.
import type { Env } from "./index.ts";
import { getChatByToken } from "./db.ts";
import { computeMember, computeReceipts, computeWrapped, type MemberWrapped, type Receipts, type Wrapped } from "./stats.ts";
import { addDays, fmtDuration, localParts } from "./logic.ts";

const h = (s: string | number | null | undefined) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, body: string, accent = "#ff7a59"): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${h(title)}</title><meta name="robots" content="noindex">
<style>
:root{--bg:#0b0b12;--fg:#f6f3ee;--muted:#9a96a6;--accent:${accent};--card:#15141f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 -apple-system,Inter,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px 16px}
.card{width:min(420px,100%);background:linear-gradient(160deg,var(--card),#0f0e17);border:1px solid #27253a;border-radius:28px;padding:28px 24px;box-shadow:0 30px 80px rgba(0,0,0,.6);position:relative;overflow:hidden}
.card::before{content:"";position:absolute;inset:-40%;background:conic-gradient(from 0deg,var(--accent),#7c5cff,#2dd4bf,var(--accent));opacity:.18;filter:blur(60px);animation:spin 14s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.in{position:relative}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{margin:6px 0 18px;font-size:30px;line-height:1.1;letter-spacing:-.02em}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 0;border-top:1px solid #23213380;opacity:0;transform:translateY(8px);animation:rise .5s ease forwards}
.row:nth-child(2){animation-delay:.1s}.row:nth-child(3){animation-delay:.2s}.row:nth-child(4){animation-delay:.3s}.row:nth-child(5){animation-delay:.4s}.row:nth-child(6){animation-delay:.5s}.row:nth-child(7){animation-delay:.6s}.row:nth-child(8){animation-delay:.7s}.row:nth-child(9){animation-delay:.8s}
@keyframes rise{to{opacity:1;transform:none}}
.k{color:var(--muted);font-size:14px}.v{font-weight:700;text-align:right}.v small{display:block;font-weight:400;color:var(--muted);font-size:12px}
.big{font-size:56px;font-weight:800;letter-spacing:-.03em;line-height:1;margin:4px 0 2px}
.persona{display:inline-block;background:var(--accent);color:#111;font-weight:800;padding:8px 14px;border-radius:999px;margin:8px 0 16px}
.foot{margin-top:18px;display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px}
button{background:var(--fg);color:#111;border:0;border-radius:999px;padding:10px 16px;font-weight:700;cursor:pointer}
.dna{font-size:34px;letter-spacing:.1em}
</style></head><body><div class="card"><div class="in">${body}</div></div>
<script>document.querySelector('#share')?.addEventListener('click',async()=>{try{if(navigator.share){await navigator.share({title:document.title,url:location.href})}else{await navigator.clipboard.writeText(location.href);document.querySelector('#share').textContent='Link copied'}}catch(e){}})</script>
</body></html>`;
}

const row = (k: string, v: string, sub?: string) => `<div class="row"><span class="k">${k}</span><span class="v">${v}${sub ? `<small>${sub}</small>` : ""}</span></div>`;
const foot = `<div class="foot"><span>Made by Lore · zero AI, zero tracking</span><button id="share">Share</button></div>`;

export function renderReceiptsCard(r: Receipts): string {
  const rows = [
    r.chattiest && row("🗣 Chattiest", h(r.chattiest.name), `${r.chattiest.value} messages`),
    r.fastest && row("⚡ Fastest replier", h(r.fastest.name), `${fmtDuration(r.fastest.value)} avg`),
    r.ghost && row("👻 Ghost", h(r.ghost.name), `${fmtDuration(r.ghost.value)} to reply`),
    r.nightOwl && row("🦉 Night owl", h(r.nightOwl.name), `${r.nightOwl.value} after midnight`),
    r.magnet && row("🧲 Reply magnet", h(r.magnet.name), `${r.magnet.value} replies received`),
    r.emoji && row("Emoji of the week", `<span style="font-size:28px">${h(r.emoji.emoji)}</span>`, `×${r.emoji.count}`),
    r.champ && row("🏆 Quiz champ", h(r.champ.name), `${r.champ.won}/${r.champ.played} correct`),
  ].filter(Boolean).join("");
  return shell(`Receipts · ${r.title}`, `<div class="eyebrow">🧾 Receipts · ${h(r.from)} → ${h(r.to)}</div><h1>${h(r.title)}</h1>
<div class="big">${r.total.toLocaleString()}</div><div class="k" style="margin-bottom:10px">messages this week</div>${rows}${foot}`);
}

export function renderWrappedCard(w: Wrapped): string {
  const rows = [
    w.busiestDay && row("📈 Busiest day", h(w.busiestDay.day), `${w.busiestDay.msgs} messages`),
    w.topChatters.length && row("🏅 Top 3", w.topChatters.slice(0, 3).map((t) => h(t.name)).join("<br>")),
    w.nightOwl && row("🦉 Night owl", h(w.nightOwl.name), `${w.nightOwl.value} after midnight`),
    w.mostQuoted && row("🎤 Most quoted", h(w.mostQuoted.name), `${w.mostQuoted.quotes} quiz quotes`),
    w.longestStreak && row("🔥 Longest streak", h(w.longestStreak.name), `${w.longestStreak.streak} days`),
    w.emojiDna.length && row("🧬 Emoji DNA", `<span class="dna">${w.emojiDna.map((e) => h(e.emoji)).join("")}</span>`),
    w.capsulesOpened && row("⏳ Capsules opened", String(w.capsulesOpened)),
  ].filter(Boolean).join("");
  return shell(`${w.year} Wrapped · ${w.title}`, `<div class="eyebrow">🎁 ${h(w.year)} Wrapped</div><h1>${h(w.title)}</h1>
<div class="big">${w.total.toLocaleString()}</div><div class="k" style="margin-bottom:10px">messages from ${w.members} people</div>${rows}${foot}`, "#7c5cff");
}

export function renderMemberCard(m: MemberWrapped): string {
  const acc = m.quizPlayed ? `${Math.round((100 * m.quizWon) / m.quizPlayed)}% right` : "never played";
  const rows = [
    row("💬 Messages", m.msgs.toLocaleString(), `#${m.rank} of ${m.of}`),
    row("🦉 After midnight", String(m.nightMsgs)),
    m.favEmoji && row("Signature emoji", `<span style="font-size:28px">${h(m.favEmoji)}</span>`),
    row("🧠 Who Said It", acc, `${m.quizPlayed} played · best streak ${m.bestStreak}`),
    m.quoted && row("🎤 Times quoted", String(m.quoted)),
  ].filter(Boolean).join("");
  return shell(`${h(m.name)} · ${m.year} Wrapped`, `<div class="eyebrow">🎁 ${h(m.year)} Wrapped · ${h(m.title)}</div><h1>${h(m.name)}</h1>
<div class="persona">${h(m.persona)}</div>${rows}${foot}`, "#2dd4bf");
}

export function renderIndex(botName: string): string {
  return shell("Lore", `<div class="eyebrow">✨ Lore</div><h1>Your group chat writes its own game.</h1>
<p class="k">A daily “who said it?” quiz from your own messages, weekly Receipts, a yearly Wrapped, and time capsules. No AI, no API keys, nothing stored longer than 30 days.</p>
<p><a href="https://t.me/${h(botName)}?startgroup=true" style="display:inline-block;background:var(--fg);color:#111;font-weight:800;padding:12px 18px;border-radius:999px;text-decoration:none">Add to a Telegram group →</a></p>
<div class="foot"><span>Open source · github.com/mohitagw15856/lore</span></div>`);
}

/** GET /c/:token/receipts | /c/:token/wrapped[/:year] | /c/:token/me/:userId[/:year] */
export async function cardRoute(url: URL, env: Env, now: number): Promise<Response> {
  const [, , token, kind, a, b] = url.pathname.split("/");
  const chat = token ? await getChatByToken(env, token) : null;
  if (!chat) return new Response("No such card.", { status: 404 });
  const html = (s: string) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
  const { day, year } = localParts(now, chat.tz_offset_min);
  if (kind === "receipts") return html(renderReceiptsCard(await computeReceipts(env, chat.chat_id, addDays(day, -6), day)));
  if (kind === "wrapped") return html(renderWrappedCard(await computeWrapped(env, chat.chat_id, a || String(year))));
  if (kind === "me" && a) {
    const m = await computeMember(env, chat.chat_id, Number(a), b || String(year));
    return m ? html(renderMemberCard(m)) : new Response("No such member.", { status: 404 });
  }
  return new Response("Not found.", { status: 404 });
}
