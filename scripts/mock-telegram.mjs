// Tiny fake Telegram Bot API for local dry runs: logs every call, answers ok.
import http from "node:http";
import { appendFileSync } from "node:fs";
let n = 100;
const log = process.argv[2] ?? "mock-telegram.log";
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const method = req.url.split("/").pop();
    appendFileSync(log, JSON.stringify({ method, body: body ? JSON.parse(body) : null }) + "\n");
    n++;
    const result = method === "sendPoll" ? { message_id: n, poll: { id: "poll" + n } }
      : method === "getMe" ? { username: "lore_bot" }
      : method === "setWebhook" || method === "setMyCommands" || method === "stopPoll" ? true
      : { message_id: n };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, result }));
  });
}).listen(8798, () => console.log("mock telegram on :8798"));
