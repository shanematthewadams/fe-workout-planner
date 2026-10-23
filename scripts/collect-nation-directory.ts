import { readFile, writeFile, rename } from "node:fs/promises";
import {
  fetchNationDirectory,
  directoryCandidates,
} from "./nation-directory.ts";
// Explicit admin command only; no build hook or automatic publication.
const directory = await fetchNationDirectory({
  token: process.env.F3_NATION_TOKEN ?? "",
  regionId: Number(process.env.F3_REGION_ID),
});
const local = JSON.parse(
  await readFile(new URL("../data/ao-official.json", import.meta.url), "utf8"),
);
const destination = new URL(
  "../data/nation-directory-candidates.json",
  import.meta.url,
);
const temporary = new URL(destination.href + ".tmp");
await writeFile(
  temporary,
  JSON.stringify(
    { ...directory, candidates: directoryCandidates(directory, local) },
    null,
    2,
  ) + "\n",
);
await rename(temporary, destination);
console.log(
  `${directory.orgs.length} official AOs and ${directory.locations.length} locations staged for review. Local records unchanged.`,
);
