import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import review from "../data/codex-planner-review.json";
import {
  createExiconReader,
  adaptExicon,
} from "../server/exicon-intelligence.ts";
import { movements } from "../src/movements.ts";
import { codexReferenceSchema } from "../src/codex-reference.ts";
const config = readFileSync("netlify.toml", "utf8"),
  setting = (key: string) =>
    config.match(new RegExp(`^${key} = "([^"]+)"`, "m"))?.[1];
const url = setting("VITE_SUPABASE_URL")!,
  key = setting("VITE_SUPABASE_PUBLISHABLE_KEY")!;
if (
  !url.includes("kitqovhdwzkhpxlepvfn.supabase.co") ||
  process.env.AO_CATALOG_ALLOW_SHARED !== "true"
)
  throw Error("Explicit shared catalog opt-in required");
const c = await createExiconReader(
  undefined,
  Date.now,
  15000,
)({ enabled: "true", url, publishableKey: key });
if (!c) throw Error("Published planner read failed");
const g = adaptExicon(c, "the-fe");
if (
  c.ex_exercises.length !== 50 ||
  g.codexIds?.length !== 35 ||
  g.codexFormats?.length !== 1 ||
  g.blockedIds.length ||
  g.ambiguousAliases.length
)
  throw Error("Wrong reviewed planner counts");
for (const m of movements) {
  const actual = g.movements.find((e) => e.id === m.id)!;
  for (const k of [
    "name",
    "instructions",
    "equipment",
    "features",
    "running",
    "alternative",
  ] as const)
    if (JSON.stringify(actual[k]) !== JSON.stringify(m[k]))
      throw Error("Unexpected canonical policy change " + m.id + " " + k);
  if (!actual.counting.includes(m.counting))
    throw Error("Counting guidance changed " + m.id);
}
const r = await fetch(url + "/rest/v1/rpc/fe_codex_reference", {
  headers: { apikey: key },
  signal: AbortSignal.timeout(15000),
});
if (!r.ok) throw Error("Reference read failed");
const reference = codexReferenceSchema.parse(await r.json()),
  sources = new Map(reference.entries.map((e) => [e.id, e]));
for (const d of review.decisions.filter((d) => d.state === "approved")) {
  const actual =
    d.target_kind === "exercise"
      ? g.movements.find((m) => m.id === d.target_id)?.codexReference
      : g.codexFormats?.find((f) => f.id === d.target_id)?.reference;
  const source = sources.get(d.entry_id!);
  if (
    !actual ||
    !source ||
    source.fingerprint !== d.entry_fingerprint ||
    actual.officialId !== source.id ||
    actual.name !== source.name ||
    (d.relation === "equivalent"
      ? actual.description !== source.description
      : actual.description !== null)
  )
    throw Error("Review/source parity failed " + d.target_id);
}
for (const method of ["POST", "PATCH", "DELETE"]) {
  const response = await fetch(
    url +
      "/rest/v1/ex_codex_planner_links" +
      (method === "POST" ? "" : "?id=eq.__never_existing_review_probe__"),
    {
      method,
      headers: { apikey: key, "Content-Type": "application/json" },
      ...(method === "DELETE"
        ? {}
        : { body: JSON.stringify({ id: "__never_existing_review_probe__" }) }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const body = await response.json();
  if (![401, 403].includes(response.status) || body.code !== "42501")
    throw Error("Expected denied write " + method + " " + response.status);
}
const report = {
  canonicalCount: c.ex_exercises.length,
  exerciseLinks: g.codexIds?.length,
  formatLinks: g.codexFormats?.length,
  allLocalPoliciesAndCountingPreserved: true,
  allReviewedSourceFieldsMatchDatabase: true,
  deniedMappingWrites: 3,
  aiCalls: 0,
  operatorTimeoutMs: 15000,
};
mkdirSync("qa/exicon-planning", { recursive: true });
writeFileSync(
  "qa/exicon-planning/hosted-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
