import { readFile, writeFile } from "node:fs/promises";
import { workoutSchema } from "../src/model.ts";
const rows = JSON.parse(await readFile("data/regional-workouts.json", "utf8"));
if (!Array.isArray(rows)) throw Error("Expected array");
const workouts = rows.map((w) => workoutSchema.parse(w));
if (
  workouts.some(
    (w) =>
      w.kind !== "source" ||
      w.provenance.status !== "regional-reviewed" ||
      !w.provenance.sourceId ||
      w.id !== w.provenance.sourceId,
  )
)
  throw Error("Only reviewed regional originals");
if (new Set(workouts.map((w) => w.id)).size !== workouts.length)
  throw Error("Duplicate IDs");
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const sql = [
  "begin;",
  "update public.workouts set published=false where managed_by='regional-import-v1';",
  ...workouts.map(
    (w) =>
      `insert into public.workouts(id,data,approved,published,managed_by) values (${quote(w.id)},${quote(JSON.stringify(w))}::jsonb,true,true,'regional-import-v1') on conflict(id) do update set data=excluded.data,approved=true,published=true,updated_at=now() where workouts.managed_by='regional-import-v1';`,
  ),
  "commit;",
].join("\n");
// SQL is a reviewable local artifact. Execute only via a dedicated project's privileged admin.
await writeFile(".imports/publish.sql", sql + "\n", { mode: 0o600 });
console.log(
  `${workouts.length} records in .imports/publish.sql. Review before applying.`,
);
