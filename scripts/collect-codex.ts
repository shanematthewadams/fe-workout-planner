import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import {
  collectCodex,
  codexIndexSchema,
  decisionsSchema,
} from "./codex-intake.ts";
const file = "data/codex-source-index.json",
  decisionFile = "data/codex-review-decisions.json";
const before = existsSync(file)
  ? codexIndexSchema.parse(JSON.parse(readFileSync(file, "utf8")))
  : undefined;
const decisions = existsSync(decisionFile)
  ? decisionsSchema.parse(JSON.parse(readFileSync(decisionFile, "utf8")))
  : {};
const result = await collectCodex(before, decisions, {
  refresh: process.argv.includes("--refresh"),
  allowLargeRemoval: process.argv.includes("--allow-large-removal"),
});
mkdirSync("qa/codex", { recursive: true });
// Advance only after the entire response passed shape, identity and completeness checks.
// These files contain IDs/fingerprints and review state, never descriptions or SQL.
writeFileSync(file + ".tmp", JSON.stringify(result.index, null, 2) + "\n");
renameSync(file + ".tmp", file);
writeFileSync(
  decisionFile,
  JSON.stringify(
    Object.fromEntries(
      Object.entries(result.decisions).filter(([, d]) => d.state !== "pending"),
    ),
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "qa/codex/reconciliation.json",
  JSON.stringify(result.report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    count: result.report.count,
    changes: result.report.changes.length,
    cached: result.cached,
    publication: result.report.publication,
    descriptionsPersisted: false,
  }),
);
