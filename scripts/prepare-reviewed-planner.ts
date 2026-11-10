import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import review from "../data/codex-planner-review.json";
import { prepareReviewedPlanner } from "./reviewed-planner.ts";
// Explicit operator preparation only; this command never connects or writes to any database.
const source = process.argv[2] ?? "qa/codex/planning-review-source.json";
const result = prepareReviewedPlanner(
  review,
  JSON.parse(readFileSync(source, "utf8")),
);
mkdirSync("qa/exicon-planning", { recursive: true });
writeFileSync("qa/exicon-planning/import.sql", result.sql, { mode: 0o600 });
writeFileSync(
  "qa/exicon-planning/report.json",
  JSON.stringify(result.report, null, 2) + "\n",
);
console.log(JSON.stringify(result.report));
