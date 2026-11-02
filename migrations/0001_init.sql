-- Lore schema. Raw message text lives in `messages` for 30 days only.
-- Everything else is counts, never content.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  chat_id INTEGER PRIMARY KEY,
  title TEXT,
  token TEXT UNIQUE NOT NULL,
  tz_offset_min INTEGER NOT NULL DEFAULT 0,
  game_hour INTEGER NOT NULL DEFAULT 9,
  paused INTEGER NOT NULL DEFAULT 0,
  installed_at INTEGER NOT NULL,
  last_game_day TEXT,
  last_receipts_week TEXT,
  last_wrapped_year TEXT
);

CREATE TABLE IF NOT EXISTS members (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  msg_count INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

-- Raw text. Purged after 30 days. Only used to pick quiz quotes.
CREATE TABLE IF NOT EXISTS messages (
  chat_id INTEGER NOT NULL,
  msg_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  ts INTEGER NOT NULL,
  quoted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, msg_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON messages (chat_id, ts);

-- Per-member per-day counts. Kept for Wrapped.
CREATE TABLE IF NOT EXISTS daily_stats (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  msgs INTEGER NOT NULL DEFAULT 0,
  night_msgs INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reply_latency_sum INTEGER NOT NULL DEFAULT 0,
  got_replies INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, user_id, day)
);

CREATE TABLE IF NOT EXISTS emoji_stats (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, user_id, day, emoji)
);

-- Quotes that were actually used in a quiz (already shown to the group).
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  msg_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  poll_id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  quote_id INTEGER NOT NULL,
  correct_idx INTEGER NOT NULL,
  options TEXT NOT NULL,
  day TEXT NOT NULL,
  posted_at INTEGER NOT NULL,
  closed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_games_chat_day ON games (chat_id, day);

CREATE TABLE IF NOT EXISTS answers (
  poll_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS scores (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS capsules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  unlock_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dm_state (
  user_id INTEGER PRIMARY KEY,
  step TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
