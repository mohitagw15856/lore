// Pure functions. No I/O, no Telegram, no DB. Everything here is unit-tested.

export const DAY_SEC = 86400;

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export function displayName(u: TgUser): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return (full || u.username || `user${u.id}`).slice(0, 32);
}

/** Local calendar parts for a unix timestamp at a fixed UTC offset. */
export function localParts(tsSec: number, tzOffsetMin: number) {
  const d = new Date((tsSec + tzOffsetMin * 60) * 1000);
  const day = d.toISOString().slice(0, 10);
  return { day, hour: d.getUTCHours(), weekday: d.getUTCDay(), year: d.getUTCFullYear() };
}

export function prevDay(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO week label like 2026-W44. */
export function isoWeek(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** "+5:30" -> 330, "-8" -> -480, "0" -> 0. null when unparseable. */
export function parseTz(input: string): number | null {
  const m = /^([+-]?)(\d{1,2})(?::(\d{2}))?$/.exec(input.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const h = Number(m[2]);
  const min = Number(m[3] ?? 0);
  if (h > 14 || min > 59) return null;
  return sign * (h * 60 + min);
}

const URL_RE = /https?:\/\/|www\.|t\.me\//i;

/** Is this message a good "Who said it?" quote. */
export function isQuoteCandidate(text: string): boolean {
  const t = text.trim();
  if (t.length < 20 || t.length > 180) return false;
  if (t.startsWith("/")) return false;
  if (URL_RE.test(t)) return false;
  if (/^@\w+/.test(t)) return false;
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters < 12) return false;
  const words = t.split(/\s+/).length;
  if (words < 4) return false;
  if (/\b\d{6,}\b/.test(t)) return false; // codes, phone numbers
  return true;
}

const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;

export function extractEmoji(text: string): string[] {
  return (text.match(EMOJI_RE) ?? []).filter((e) => !/^[0-9#*©®™]$/.test(e)).slice(0, 20);
}

export type Rnd = () => number;

export function shuffleWith<T>(arr: T[], rnd: Rnd): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildOptions(correct: string, others: string[], rnd: Rnd = Math.random) {
  const options = shuffleWith([correct, ...others.slice(0, 3)], rnd);
  return { options, correctIdx: options.indexOf(correct) };
}

/** Streak counts consecutive game days answered correctly. */
export function nextStreak(prev: number, lastDay: string | null, gameDay: string, correct: boolean): number {
  if (!correct) return 0;
  if (lastDay && lastDay === prevDay(gameDay)) return prev + 1;
  return 1;
}

/** 10 for a correct answer, plus a small streak bonus capped at 5. */
export function pointsFor(correct: boolean, streak: number): number {
  if (!correct) return 0;
  return 10 + Math.min(5, Math.max(0, streak - 1));
}

export function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < DAY_SEC) return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / DAY_SEC)}d ${Math.floor((sec % DAY_SEC) / 3600)}h`;
}

export function parseDate(input: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) return null;
  return d.toISOString().slice(0, 10);
}

export function medal(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;
}

export function randomToken(len = 16): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}
