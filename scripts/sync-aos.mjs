import { readFile, writeFile, rename } from "node:fs/promises";
import { parseSchedule } from "./ao-sync.mjs";
const source = process.argv[2];
try {
  const html = source
    ? await readFile(source, "utf8")
    : await (async () => {
        const r = await fetch("https://f3thefe.com/schedule/", {
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw Error();
        return r.text();
      })();
  const rows = parseSchedule(html, new Date().toISOString());
  await writeFile(
    "data/ao-official.json.tmp",
    JSON.stringify(rows, null, 2) + "\n",
  );
  await rename("data/ao-official.json.tmp", "data/ao-official.json");
  console.log(
    `${rows.length} AO profiles updated; local attributes untouched. Review source diff before commit.`,
  );
} catch {
  console.error("AO sync failed; last snapshot retained.");
  process.exitCode = 1;
}
