import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(
  new URL("../src/catalog.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { catalog } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const sql =
  "-- Original illustrative starters. Run only in a dedicated FE project.\n" +
  catalog
    .map(
      (w) =>
        `insert into public.workouts (id,data,published) values (${quote(w.id)},${quote(JSON.stringify(w))}::jsonb,true) on conflict (id) do nothing;`,
    )
    .join("\n") +
  "\n";
await writeFile(new URL("../docs/starter-seed.sql", import.meta.url), sql);
console.log(
  `Wrote ${catalog.length} starter inserts; existing IDs are preserved.`,
);
