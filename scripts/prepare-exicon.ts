import { mkdirSync, writeFileSync } from "node:fs";
import {
  buildAppExicon,
  exiconImportSQL,
  EXICON_TABLE_KEYS,
} from "./exicon-catalog.ts";
import { movements } from "../src/movements.ts";
const catalog = buildAppExicon();
const included = new Set(catalog.ex_exercises.map((e) => e.id));
const report = {
  included: catalog.ex_exercises.map((e) => ({
    id: e.id,
    name: e.name,
    decision: "app-written description; existing ID preserved",
  })),
  withheld: movements
    .filter((m) => !included.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      reason:
        "Bundled reference text; source permission not established for database redistribution",
    })),
  counts: Object.fromEntries(
    Object.keys(EXICON_TABLE_KEYS).map((table) => [
      table,
      catalog[table as keyof typeof EXICON_TABLE_KEYS].length,
    ]),
  ),
  limits: [
    "No official Exicon fetched/imported",
    "No application selector switch",
    "No AI or database calls",
    "Unknown counting requires confirmation",
    "Formats are vocabulary, not an execution engine",
  ],
};
mkdirSync("qa/exicon", { recursive: true });
writeFileSync(
  "qa/exicon/catalog.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
writeFileSync("qa/exicon/import.sql", exiconImportSQL(catalog) + "\n");
writeFileSync(
  "qa/exicon/source-review.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    counts: report.counts,
    withheld: report.withheld.length,
    target: "files only",
  }),
);
