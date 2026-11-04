import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { codexReferenceSchema, searchCodex } from "../src/codex-reference.ts";
import { prepareCodexReference } from "./codex-reference.ts";
import { createCodexReader } from "../server/codex-reference.ts";
const config = readFileSync("netlify.toml", "utf8");
const setting = (key: string) =>
  config.match(new RegExp(`^${key} = "([^"]+)"`, "m"))?.[1];
const url = setting("VITE_SUPABASE_URL")!,
  key = setting("VITE_SUPABASE_PUBLISHABLE_KEY")!;
if (
  !url.includes("kitqovhdwzkhpxlepvfn.supabase.co") ||
  !key.startsWith("sb_publishable_")
)
  throw Error("Unexpected catalog target");
mkdirSync("qa/codex", { recursive: true });
const mode = process.argv.includes("--staging") ? "staging" : "database";
let actual;
if (mode === "staging") {
  const r = await fetch(
    "https://studio-ux-streamline--fe-workout-planner.netlify.app/api/codex",
    { redirect: "error", signal: AbortSignal.timeout(20000) },
  );
  if (!r.ok) throw Error("Staging Codex status: " + r.status);
  const body = await r.json();
  if (body.source !== "database")
    throw Error("Staging reference fallback is not database evidence");
  actual = codexReferenceSchema.parse(body.reference);
} else {
  if (process.env.AO_CATALOG_ALLOW_SHARED !== "true")
    throw Error(
      "Shared database verification needs explicit operator environment",
    );
  // Restricted operator networks get an explicit diagnostic allowance; app reads stay at two seconds.
  actual = await createCodexReader(
    undefined,
    Date.now,
    15000,
  )({ enabled: "true", url, publishableKey: key });
  if (!actual) throw Error("Database snapshot read failed");
  const capture = JSON.parse(
    readFileSync("qa/codex/reference-capture.json", "utf8"),
  );
  const prepared = prepareCodexReference(
    capture.raw,
    JSON.parse(readFileSync("data/codex-reuse-decision.json", "utf8")),
    capture.capturedAt,
  );
  const byId = new Map(actual.entries.map((e) => [e.id, e]));
  const tags = new Map(prepared.tags.map((t) => [t.id, t.name]));
  for (const e of prepared.entries) {
    const a = byId.get(e.id);
    if (
      !a ||
      a.name !== e.name ||
      a.description !== e.description ||
      a.fingerprint !== e.fingerprint ||
      JSON.stringify([...a.aliases].sort()) !==
        JSON.stringify([...e.aliases].sort()) ||
      JSON.stringify([...a.tags].sort()) !==
        JSON.stringify(e.tag_ids.map((id) => tags.get(id)).sort()) ||
      JSON.stringify([...a.mentioned_ids].sort()) !==
        JSON.stringify([...e.mentioned_ids].sort())
    )
      throw Error("Live content mismatch: " + e.id);
  }
  if (actual.entries.length !== prepared.entries.length)
    throw Error("Unexpected live extras");
  for (const table of [
    "reuse",
    "entries",
    "aliases",
    "tags",
    "entry_tags",
    "mentions",
  ]) {
    for (const method of ["POST", "PATCH", "DELETE"]) {
      // No operator key. Match a synthetic non-existent ID on destructive verbs.
      const filter = table === "reuse" ? "source_id" : "id";
      const endpoint =
        `${url}/rest/v1/ex_codex_${table}` +
        (method === "POST"
          ? ""
          : `?${["aliases", "entry_tags", "mentions"].includes(table) ? "entry_id" : filter}=eq.f3-qa-never-existing`);
      const res = await fetch(endpoint, {
        method,
        headers: { apikey: key, "Content-Type": "application/json" },
        ...(method !== "DELETE"
          ? {
              body: JSON.stringify({
                [["aliases", "entry_tags", "mentions"].includes(table)
                  ? "entry_id"
                  : filter]: "f3-qa-never-existing",
              }),
            }
          : {}),
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.json();
      if (![401, 403].includes(res.status) || body.code !== "42501")
        throw Error(
          "Write denial mismatch: " + table + " " + method + " " + res.status,
        );
    }
  }
}
const expected = JSON.parse(
  readFileSync("data/codex-source-index.json", "utf8"),
)
  .entries.filter((e: { present: boolean }) => e.present)
  .map((e: { id: string }) => e.id)
  .sort();
if (
  JSON.stringify(actual.entries.map((e) => e.id).sort()) !==
  JSON.stringify(expected)
)
  throw Error("Live source ID baseline differs; reconcile before advancing");
if (!searchCodex(actual, "merkin").length) throw Error("Search failed");
const report = {
  mode,
  count: actual.entries.length,
  aliases: actual.entries.reduce((n, e) => n + e.aliases.length, 0),
  tags: new Set(actual.entries.flatMap((e) => e.tags)).size,
  allIdsMatchBaseline: true,
  fullSourceParity: mode === "database",
  deniedWrites: mode === "database" ? 18 : 0,
  aiCalls: 0,
};
writeFileSync(
  `qa/codex/${mode}-verification.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
