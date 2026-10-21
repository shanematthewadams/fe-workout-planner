import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
const commit =
  process.env.COMMIT_REF ||
  process.env.GITHUB_SHA ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw Error("Invalid build commit");
await writeFile(
  "dist/build-info.json",
  JSON.stringify({
    commit,
    environment: process.env.VITE_APP_ENV || "production",
  }) + "\n",
);
