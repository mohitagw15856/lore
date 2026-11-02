// Renders the three shareable cards with sample data into docs/demo/ so the README can show them.
// Run: node scripts/render-samples.ts  (Node 22.6+ strips types natively)
import { mkdirSync, writeFileSync } from "node:fs";
import { renderMemberCard, renderReceiptsCard, renderWrappedCard } from "../src/cards.ts";
import { SAMPLE_MEMBER, SAMPLE_RECEIPTS, SAMPLE_WRAPPED } from "./samples.ts";

mkdirSync("docs/demo", { recursive: true });
writeFileSync("docs/demo/receipts.html", renderReceiptsCard(SAMPLE_RECEIPTS));
writeFileSync("docs/demo/wrapped.html", renderWrappedCard(SAMPLE_WRAPPED));
writeFileSync("docs/demo/me.html", renderMemberCard(SAMPLE_MEMBER));
console.log("rendered docs/demo/{receipts,wrapped,me}.html");
