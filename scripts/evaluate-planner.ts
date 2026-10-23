import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { runEvaluation } from "../server/planner-evaluation";
async function main() {
  const target =
    process.argv[2] ??
    "https://studio-ux-streamline--fe-workout-planner.netlify.app";
  const output = process.argv[3] ?? "qa/live-ai-evaluation.json";
  const report = await runEvaluation(target);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      passed: report.passed,
      results: report.results.map((value) => ({
        id: value.id,
        outcome: value.outcome,
        status: value.status,
      })),
      report: output,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
void main().catch(() => {
  console.error("Evaluation could not run.");
  process.exitCode = 1;
});
