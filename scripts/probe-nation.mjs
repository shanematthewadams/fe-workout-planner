import { probeNation } from "./nation-probe.mjs";
// Optional diagnostics never block the independent library build.
console.log(
  "FE_SOURCE_PROBE " + JSON.stringify(await probeNation(process.env)),
);

if (
  process.env.NETLIFY === "true" &&
  process.env.CONTEXT === "branch-deploy" &&
  process.env.BRANCH === "develop"
) {
  const { spawnSync } = await import("node:child_process");
  const child = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/collect-nation.ts"],
    { stdio: "inherit" },
  );
  if (child.status !== 0)
    console.log(
      "FE_PRIVATE_REVIEW_EXPORT not refreshed; no published records changed.",
    );
}
