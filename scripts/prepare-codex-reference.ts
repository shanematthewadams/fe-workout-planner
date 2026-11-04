import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { boundedText } from "../server/exicon-intelligence.ts";
import { CODEX_URL } from "./codex-intake.ts";
import { prepareCodexReference, codexReferenceSQL } from "./codex-reference.ts";
const cache = "qa/codex/reference-capture.json";
mkdirSync("qa/codex", { recursive: true });
let capture: { capturedAt: string; raw: unknown } | undefined;
if (existsSync(cache) && !process.argv.includes("--refresh")) {
  const saved = JSON.parse(readFileSync(cache, "utf8"));
  const age = Date.now() - Date.parse(saved.capturedAt);
  if (age >= 0 && age < 86400000) capture = saved;
}
const cached = !!capture;
if (!capture) {
  const r = await fetch(CODEX_URL, {
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    headers: { "User-Agent": "F3-Q-Builder/1.0 (daily catalog import)" },
  });
  if (!r.ok) throw Error("Codex read failed: " + r.status);
  capture = {
    capturedAt: new Date().toISOString(),
    raw: JSON.parse(await boundedText(r, 20_000_000)),
  };
}
const prepared = prepareCodexReference(
  capture.raw,
  JSON.parse(readFileSync("data/codex-reuse-decision.json", "utf8")),
  capture.capturedAt,
);
const sql = codexReferenceSQL(prepared);
// Write only after complete validation. Never connect to Supabase from this CLI.
for (const [path, content] of [
  [cache, JSON.stringify(capture)],
  ["qa/codex/reference.sql", sql],
  ["qa/codex/reference-report.json", JSON.stringify(prepared.report, null, 2)],
]) {
  writeFileSync(path + ".tmp", content + "\n", { mode: 0o600 });
  renameSync(path + ".tmp", path);
}
console.log(JSON.stringify({ ...prepared.report, cached, sqlGenerated: true }));
