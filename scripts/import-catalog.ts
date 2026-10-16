import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import {
  sourceSchema,
  mergeSources,
  approve,
  publishedWorkouts,
  extractSections,
  type RecordEntry,
} from "./catalog-import.ts";
import { fetchNation } from "./nation-adapter.ts";
const root = new URL("../", import.meta.url);
const file = new URL(".imports/review.json", root);
async function atomic(url: URL, data: unknown) {
  const temp = new URL(url.href + ".tmp");
  await writeFile(temp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  await rename(temp, url);
}
async function main() {
  await mkdir(new URL(".imports/", root), { recursive: true, mode: 0o700 });
  let existing: RecordEntry[] = [];
  try {
    existing = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const [command, input, hash, reviewer] = process.argv.slice(2);
  if (command === "nation") {
    const records = await fetchNation({
      token: process.env.F3_NATION_TOKEN ?? "",
      regionId: Number(process.env.F3_REGION_ID),
      startDate: input,
      endDate: hash,
    });
    // Only recognized workout sections survive. Never persist the full narrative or attendance.
    const candidates = records.map((r) => ({
      sourceId: `f3nation:event:${r.id}`,
      url: `https://map.f3nation.com/`,
      title: (r.name || "Untitled backblast").slice(0, 160),
      ao: r.org?.name,
      eventDate: r.startDate?.slice(0, 10),
      sections: extractSections(r.backblast ?? ""),
      reuse: { basis: "unresolved", evidence: "" },
      issues: [
        "Privacy review required; heading extraction is not a privacy guarantee",
        "Source URL is map home; event deep link unverified",
      ],
    }));
    // Do not overwrite approved records based on an unreviewed automatic extraction.
    await atomic(new URL(".imports/nation-candidates.json", root), candidates);
    console.log(
      `${candidates.length} local candidates; not published. Review privacy, rights, source URL and counts before merge.`,
    );
  } else if (command === "merge") {
    const incoming = JSON.parse(await readFile(input, "utf8"));
    if (!Array.isArray(incoming)) throw Error("Expected array");
    const next = mergeSources(
      existing,
      incoming.map((s) => sourceSchema.parse(s)),
    );
    await atomic(file, next);
    console.log(
      `${next.length} source records; ${publishedWorkouts(next).length} approved.`,
    );
  } else if (command === "approve") {
    let found = false;
    const next = existing.map((r) => {
      if (r.sourceId !== input) return r;
      found = true;
      return approve(r, hash, reviewer);
    });
    if (!found) throw Error("Source ID not found");
    await atomic(file, next);
    console.log("Approved matching source hash.");
  } else if (command === "export") {
    const records = publishedWorkouts(existing);
    await atomic(new URL("data/regional-workouts.json", root), records);
    console.log(
      `${records.length} reviewed originals exported. Review diff before commit.`,
    );
  } else
    throw Error(
      "Use nation START END | merge FILE | approve SOURCE_ID HASH REVIEWER | export",
    );
}
main().catch(() => {
  console.error(
    "Import stopped. Verify command, configuration and local review file. No credentials or source text are logged.",
  );
  process.exitCode = 1;
});
