import { readFile, writeFile, rename } from "node:fs/promises";
import { importSiteQRoster } from "./site-q-roster.ts";
const input = process.argv[2];
if (!input)
  throw Error("Provide a JSON values array read from AO Directory!A4:C21.");
const local = JSON.parse(
  await readFile(new URL("../data/ao-official.json", import.meta.url), "utf8"),
);
const values = JSON.parse(await readFile(input, "utf8"));
const siteQs = importSiteQRoster(values, local);
if (Object.keys(siteQs).length !== local.length)
  throw Error("Incomplete AO roster; previous source retained.");
if (!Object.values(siteQs).some((row) => row.names.length))
  throw Error("Empty Site Q roster; prior data retained.");
const destination = new URL("../data/ao-site-qs.json", import.meta.url);
const temporary = new URL(destination.href + ".tmp");
await writeFile(
  temporary,
  JSON.stringify(
    {
      sourceUrl:
        "https://docs.google.com/spreadsheets/d/1bc2SK_VebCAZQTn4r54XV4AcFKtDwr1Dqwb8UxP1Tmw/edit#gid=201",
      sheet: "AO Directory",
      range: "A4:C21",
      checkedAt: new Date().toISOString(),
      siteQs,
    },
    null,
    2,
  ) + "\n",
);
await rename(temporary, destination);
console.log(
  `${Object.keys(siteQs).length} AO Site Q rosters refreshed from the explicit inventory column.`,
);
