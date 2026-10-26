import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const origin = "https://studio-ux-streamline--fe-workout-planner.netlify.app";
const response = await fetch(origin + "/api/exicon?region=the-fe", {
  signal: AbortSignal.timeout(10000),
});
assert.equal(response.status, 200);
const guide = await response.json();
assert.equal(guide.version, 1);
assert.equal(guide.source, "database");
assert.equal(guide.databaseIds.length, 8);
assert.equal(guide.movements.length, 50);
assert.deepEqual(guide.blockedIds, []);
assert.match(
  guide.movements.find((m) => m.id === "mountain-climber").counting,
  /Q must choose/,
);
assert.ok(!JSON.stringify(guide).includes("sb_publishable_"));
const report = {
  checkedAt: new Date().toISOString(),
  source: guide.source,
  databaseIds: guide.databaseIds,
  movementCount: guide.movements.length,
  providerCheck: "not requested",
};
if (process.argv.includes("--ai")) {
  const r = await fetch(origin + "/api/plan-workout", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt:
        "Create a simple bodyweight circuit using squats and plank. No running or gear. Explain complete reps and rest.",
      ao: "Gold Rush",
      equipment: "None",
      running: "None",
      minutes: 45,
      mary: true,
      strictSchedule: true,
    }),
    signal: AbortSignal.timeout(40000),
  });
  const result = await r.json().catch(() => ({}));
  report.providerCheck = {
    status: r.status,
    source: r.headers.get("x-f3-exicon-source"),
    provider: result.provider ?? null,
    model: result.model ?? null,
    success:
      r.ok &&
      r.headers.get("x-f3-exicon-source") === "database" &&
      result.provider !== "Template" &&
      !!result.plan,
  };
  if (!report.providerCheck.success) process.exitCode = 2;
  // Store only diagnostics; this check does not save a workout, sign in or write cloud data.
}
await mkdir("qa/exicon", { recursive: true });
await writeFile(
  "qa/exicon/staging-read-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
