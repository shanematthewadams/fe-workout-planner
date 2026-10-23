import { readFile, writeFile } from "node:fs/promises";
import { parseAOUpdate, reviewedAO } from "../src/ao-review.ts";
const args = process.argv.slice(2);
const value = (flag: string) => args[args.indexOf(flag) + 1];
if (!args.includes("--input") || !args.includes("--reviewer"))
  throw Error(
    'Use --input proposal.json --reviewer "Regional reviewer" [--apply]',
  );
const update = parseAOUpdate(await readFile(value("--input"), "utf8"));
const next = reviewedAO(update, value("--reviewer"));
console.log(JSON.stringify({ aoId: update.aoId, reviewed: next }, null, 2));
if (args.includes("--apply")) {
  const file = new URL("../data/ao-local.json", import.meta.url);
  const data = JSON.parse(await readFile(file, "utf8"));
  data[update.aoId] = { ...data[update.aoId], ...next };
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}
