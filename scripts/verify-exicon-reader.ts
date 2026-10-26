import { writeFileSync, mkdirSync } from "node:fs";
import {
  createExiconReader,
  adaptExicon,
} from "../server/exicon-intelligence.ts";
const url = process.env.AO_CATALOG_URL,
  key = process.env.AO_CATALOG_PUBLISHABLE_KEY;
if (!url || !key?.startsWith("sb_publishable_"))
  throw Error("Set catalog URL and publishable key");
if (
  new URL(url).hostname === "kitqovhdwzkhpxlepvfn.supabase.co" &&
  process.env.AO_CATALOG_ALLOW_SHARED !== "true"
)
  throw Error("Shared read requires explicit operator opt-in");
let calls = 0;
// The operator runtime uses a restricted egress proxy; allow a diagnostic budget.
// Application reads retain their two-second production timeout.
const read = createExiconReader(
  (input, init) => {
    calls++;
    return fetch(input, init);
  },
  Date.now,
  15000,
);
const env = { enabled: "true", url, publishableKey: key };
const [a, b] = await Promise.all([read(env), read(env)]);
if (!a || a !== b || calls !== 1)
  throw Error("Live snapshot/coalescing did not pass");
const guide = adaptExicon(a, "the-fe");
if (
  guide.databaseIds.length !== 8 ||
  guide.movements.length !== 50 ||
  guide.source !== "database" ||
  guide.blockedIds.length
)
  throw Error("Live adapter did not match the published baseline");
const report = {
  checkedAt: new Date().toISOString(),
  calls,
  operatorTimeoutMs: 15000,
  source: guide.source,
  publishedExercises: a.ex_exercises.length,
  publishedAliases: a.ex_aliases.length,
  mergedMovements: guide.movements.length,
  blockedIds: guide.blockedIds,
  ambiguousAliases: guide.ambiguousAliases,
};
mkdirSync("qa/exicon", { recursive: true });
writeFileSync(
  "qa/exicon/live-reader.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
