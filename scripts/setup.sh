#!/usr/bin/env bash
# One-shot setup from a terminal. The alternative is the Deploy-to-Cloudflare button in the README.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v npx >/dev/null || { echo "Need Node + npm"; exit 1; }
[ -d node_modules ] || npm install

echo "→ Creating D1 database 'lore' (skips if it exists)"
ID=$(npx wrangler d1 create lore 2>/dev/null | grep -oE '[0-9a-f-]{36}' | head -1 || true)
if [ -n "${ID:-}" ]; then
  sed -i.bak "s/database_id = \".*\"/database_id = \"$ID\"/" wrangler.toml && rm -f wrangler.toml.bak
  echo "  database_id → $ID"
fi

echo "→ Applying migrations"
npx wrangler d1 migrations apply lore --remote

read -rp "Bot username (without @): " BOT
sed -i.bak "s/^BOT_NAME = \".*\"/BOT_NAME = \"$BOT\"/" wrangler.toml && rm -f wrangler.toml.bak

echo "→ Secrets"
npx wrangler secret put BOT_TOKEN
SECRET=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 40)
printf '%s' "$SECRET" | npx wrangler secret put WEBHOOK_SECRET

echo "→ Deploying"
URL=$(npx wrangler deploy | grep -oE 'https://[^ ]+workers\.dev' | head -1)

echo "→ Registering webhook"
curl -s "$URL/setup?secret=$SECRET"; echo
echo
echo "Done. Add the bot to a group: https://t.me/$BOT?startgroup=true"
echo "Don't forget: @BotFather → /setprivacy → Disable (so the bot can read group messages)."
