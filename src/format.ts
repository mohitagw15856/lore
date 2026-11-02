import { esc } from "./telegram.ts";
import { fmtDuration } from "./logic.ts";
import type { Receipts, Wrapped } from "./stats.ts";

export function receiptsText(r: Receipts, cardUrl: string | null): string {
  if (r.total === 0) return "🧾 <b>Receipts</b>\n\nA quiet week. Not a single message. Are you all okay?";
  const lines = [`🧾 <b>Receipts</b> · ${esc(r.title)} · ${r.from} → ${r.to}`, "", `💬 ${r.total} messages this week`];
  if (r.chattiest) lines.push(`🗣 Chattiest: <b>${esc(r.chattiest.name)}</b> (${r.chattiest.value})`);
  if (r.fastest) lines.push(`⚡ Fastest replier: <b>${esc(r.fastest.name)}</b> (${fmtDuration(r.fastest.value)} avg)`);
  if (r.ghost) lines.push(`👻 Ghost: <b>${esc(r.ghost.name)}</b> (${fmtDuration(r.ghost.value)} to reply)`);
  if (r.nightOwl) lines.push(`🦉 Night owl: <b>${esc(r.nightOwl.name)}</b> (${r.nightOwl.value} msgs after midnight)`);
  if (r.magnet) lines.push(`🧲 Reply magnet: <b>${esc(r.magnet.name)}</b> (${r.magnet.value} replies received)`);
  if (r.emoji) lines.push(`${r.emoji.emoji} Emoji of the week (×${r.emoji.count})`);
  if (r.champ) lines.push(`🏆 Quiz champ: <b>${esc(r.champ.name)}</b> (${r.champ.won}/${r.champ.played}${r.champ.streak >= 2 ? `, 🔥${r.champ.streak}` : ""})`);
  if (cardUrl) lines.push("", `🖼 Shareable card: ${cardUrl}`);
  return lines.join("\n");
}

export function wrappedText(w: Wrapped, cardUrl: string | null): string {
  if (w.total === 0) return `🎁 <b>${w.year} Wrapped</b>\n\nNothing to wrap yet. I only count from the day I was added.`;
  const lines = [`🎁 <b>${esc(w.title)} · ${w.year} Wrapped</b>`, "", `💬 ${w.total.toLocaleString()} messages from ${w.members} people`];
  if (w.busiestDay) lines.push(`📈 Busiest day: ${w.busiestDay.day} (${w.busiestDay.msgs} msgs)`);
  if (w.topChatters.length) lines.push(`🏅 Top 3: ${w.topChatters.slice(0, 3).map((t) => `<b>${esc(t.name)}</b>`).join(", ")}`);
  if (w.nightOwl) lines.push(`🦉 Night owl: <b>${esc(w.nightOwl.name)}</b>`);
  if (w.emojiDna.length) lines.push(`🧬 Emoji DNA: ${w.emojiDna.map((e) => e.emoji).join(" ")}`);
  if (w.mostQuoted) lines.push(`🎤 Most quoted: <b>${esc(w.mostQuoted.name)}</b> (${w.mostQuoted.quotes}×)`);
  if (w.longestStreak) lines.push(`🔥 Longest quiz streak: <b>${esc(w.longestStreak.name)}</b> (${w.longestStreak.streak})`);
  if (w.capsulesOpened) lines.push(`⏳ Time capsules opened: ${w.capsulesOpened}`);
  if (cardUrl) lines.push("", `🖼 Your cards: ${cardUrl}`);
  return lines.join("\n");
}

export const HELP = `✨ <b>Lore</b> turns this group's own history into a game.

🧠 <b>Who Said It</b> — a real quote from this chat, every day. Guess who.
🧾 <b>Receipts</b> — weekly stats. Fastest replier, ghost, night owl.
🎁 <b>Wrapped</b> — a yearly shareable card for the group and each member.
⏳ <b>Time capsules</b> — seal a message that opens here on a future date.

<b>Commands</b>
/play — post a quiz now
/leaderboard — the standings
/receipts — this week's stats
/wrapped — the year so far
/capsule — seal a time capsule (via DM)
/settime 9 — hour the daily quiz posts (local)
/timezone +5:30 — set the group's UTC offset
/pause · /resume — stop or restart daily posts
/privacy — what I store and for how long
/forgetme — delete everything about you, instantly
/help — this message`;

export const PRIVACY = `🔒 <b>Privacy, plainly</b>

• I only see messages sent <b>after</b> I was added. Never earlier.
• Raw text is kept for <b>30 days</b> so I can pick quiz quotes, then deleted.
• What stays: counts (messages per day, replies, emoji) and quotes already shown in a quiz.
• <b>Remove me</b> from the group and everything about this group is deleted at once.
• <b>/forgetme</b> deletes everything about you, in this group or everywhere if you send it in DM.
• No AI, no third parties, no ads. Open source: github.com/mohitagw15856/lore`;

export function welcomeText(botName: string): string {
  return `👋 Hi! I'm <b>Lore</b>. From now on this group writes its own game.

Every day at 9:00 I'll post a real quote from this chat and ask <b>who said it</b>. Weekly Receipts on Mondays. A Wrapped card at the end of the year.

I only count from today. Nothing before. /privacy has the details.

Tip: /settime 21 if you'd rather play in the evening. /timezone +5:30 if your group isn't on UTC.

Add me to another group: t.me/${botName}?startgroup=true`;
}
