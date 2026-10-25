/** Offline release evidence: real PostgreSQL engine, no remote credentials or network. */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { buildCatalog, importSQL } from "./ao-intelligence.ts";
const db = new PGlite();
const { catalog, issues } = buildCatalog();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role;",
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261025175228_ao_intelligence_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(importSQL(catalog));
  const counts: Record<string, number> = {};
  for (const table of Object.keys(catalog))
    counts[table] = (
      await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)
    ).rows[0].n;
  const repeated = await db.exec(importSQL(catalog));
  const repeatConflicts = repeated.flatMap((r) => r.rows);
  if (repeatConflicts.length) throw Error("Repeat import had conflicts");
  const availability = (
    await db.query(
      "select availability,verification,count(*)::int as count from ao_venue_amenities group by 1,2 order by 1,2",
    )
  ).rows;
  const policies = (
    await db.query(
      "select tablename,policyname,cmd,roles from pg_policies where schemaname='public' order by tablename,policyname",
    )
  ).rows;
  const sourceIssues = Object.fromEntries(
    [...new Set(issues.map((i) => i.kind))].map((k) => [
      k,
      issues.filter((i) => i.kind === k).length,
    ]),
  );
  const evidence = {
    environment:
      "Isolated PGlite PostgreSQL; actual SQL execution and relational readback. Not hosted Supabase/PostgREST.",
    counts,
    availability,
    repeatConflicts,
    sourceIssues,
    policies,
  };
  mkdirSync(new URL("../docs/ao-intelligence/", import.meta.url), {
    recursive: true,
  });
  writeFileSync(
    new URL("../docs/ao-intelligence/verification.json", import.meta.url),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  writeFileSync(
    new URL("../docs/ao-intelligence/reconciliation.json", import.meta.url),
    JSON.stringify(issues, null, 2) + "\n",
  );
  console.log(JSON.stringify({ counts, availability, sourceIssues }));
} finally {
  await db.close();
}
