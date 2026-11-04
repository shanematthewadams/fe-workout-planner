import { readFileSync, writeFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { prepareCodexReference, codexReferenceSQL } from "./codex-reference.ts";
import { codexReferenceSchema } from "../src/codex-reference.ts";
const capture = JSON.parse(
  readFileSync("qa/codex/reference-capture.json", "utf8"),
);
const prepared = prepareCodexReference(
  capture.raw,
  JSON.parse(readFileSync("data/codex-reuse-decision.json", "utf8")),
  capture.capturedAt,
);
const db = new PGlite();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role;",
  );
  for (const file of [
    "20261025175228_ao_intelligence_foundation.sql",
    "20261104153007_codex_reference_catalog.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(codexReferenceSQL(prepared));
  const second = await db.exec(codexReferenceSQL(prepared));
  const repeat = second
    .flatMap((r) => r.rows)
    .find((r) => "reconciliation" in r)?.reconciliation as {
    changed: number;
    removed: number;
    conflicts: unknown[];
  };
  if (repeat.changed || repeat.removed || repeat.conflicts.length)
    throw Error("Repeated import was not a no-op");
  const rows = [];
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    const actual = codexReferenceSchema.parse(
      (await db.query<{ data: unknown }>("select fe_codex_reference() data"))
        .rows[0].data,
    );
    if (actual.entries.length !== prepared.entries.length)
      throw Error("Wrong entry count");
    const byId = new Map(actual.entries.map((e) => [e.id, e]));
    const tags = new Map(prepared.tags.map((t) => [t.id, t.name]));
    for (const e of prepared.entries) {
      const a = byId.get(e.id)!;
      if (
        a.name !== e.name ||
        a.description !== e.description ||
        a.fingerprint !== e.fingerprint ||
        JSON.stringify(a.aliases.slice().sort()) !==
          JSON.stringify(e.aliases.slice().sort()) ||
        JSON.stringify(a.tags.slice().sort()) !==
          JSON.stringify(e.tag_ids.map((id) => tags.get(id)).sort()) ||
        JSON.stringify(a.mentioned_ids.slice().sort()) !==
          JSON.stringify(e.mentioned_ids.slice().sort())
      )
        throw Error("Content mismatch: " + e.id);
    }
    rows.push({
      role,
      count: actual.entries.length,
      allEntryAndRelationshipParity: true,
    });
    await db.exec("reset role");
  }
  await db.exec(
    readFileSync("supabase/rollback/codex_reference_catalog.sql", "utf8"),
  );
  const report = { ...prepared.report, rows, repeat, rollback: true };
  writeFileSync(
    "qa/codex/local-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await db.close();
}
