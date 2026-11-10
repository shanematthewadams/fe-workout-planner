import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import review from "../data/codex-planner-review.json";
import { prepareReviewedPlanner } from "./reviewed-planner.ts";
import { buildAppExicon, exiconImportSQL } from "./exicon-catalog.ts";
import { plannerExiconSchema } from "../src/codex-planner.ts";
import { movements } from "../src/movements.ts";
import { adaptExicon } from "../server/exicon-intelligence.ts";
const raw = JSON.parse(
  readFileSync(
    process.argv[2] ?? "qa/codex/planning-review-source.json",
    "utf8",
  ),
);
const prepared = prepareReviewedPlanner(review, raw),
  q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const ids = new Set(
  review.decisions.filter((d) => d.state === "approved").map((d) => d.entry_id),
);
const sources = (
  raw as {
    id: string;
    name: string;
    description: string;
    fingerprint: string;
  }[]
).filter((e) => ids.has(e.id));
const db = new PGlite();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role;",
  );
  for (const f of [
    "20261025175228_ao_intelligence_foundation.sql",
    "20261026015007_exicon_foundation.sql",
    "20261026143249_exicon_read_snapshot.sql",
    "20261104153007_codex_reference_catalog.sql",
    "20261110192426_reviewed_codex_planner_links.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  await db.exec(
    "insert into ao_amenity_types values('benches','Benches'),('workout-walls','Walls'),('pull-up-bars','Bars');",
  );
  await db.exec(exiconImportSQL(buildAppExicon()));
  await db.exec(
    "insert into ao_sources values('review-source','nation','https://codex.f3nation.com/api/exicon','2026-11-04','Actual published reference capture');insert into ex_codex_reuse(source_id,decision_id,decided_by,decided_at,basis,upstream_permission,rationale,enabled) values('review-source','fixture','Engineering','2026-11-04','product-owner-interpretation','unresolved','Local verification of the already authorized reference corpus',true);",
  );
  await db.exec(
    "insert into ex_codex_entries(id,name,description,fingerprint,captured_at,source_id) values " +
      sources
        .map(
          (e) =>
            `(${q(e.id)},${q(e.name)},${q(e.description)},${q(e.fingerprint)},'2026-11-04','review-source')`,
        )
        .join(","),
  );
  await db.exec(prepared.sql);
  const first = JSON.stringify(
    (await db.query("select * from ex_codex_planner_links order by id")).rows,
  );
  await db.exec(prepared.sql);
  if (
    first !==
    JSON.stringify(
      (await db.query("select * from ex_codex_planner_links order by id")).rows,
    )
  )
    throw Error("Repeat changed review rows");
  const roles = [];
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    const c = plannerExiconSchema.parse(
      (
        await db.query<{ data: unknown }>(
          "select fe_exicon_planner_catalog() data",
        )
      ).rows[0].data,
    );
    const g = adaptExicon(c);
    if (
      c.ex_exercises.length !== 50 ||
      g.codexIds?.length !== 35 ||
      g.codexFormats?.length !== 1 ||
      g.blockedIds.length ||
      g.ambiguousAliases.length
    )
      throw Error("Planner read mismatch");
    for (const m of movements) {
      const actual = g.movements.find((e) => e.id === m.id)!;
      for (const key of [
        "name",
        "instructions",
        "equipment",
        "features",
        "running",
        "alternative",
      ] as const)
        if (JSON.stringify(actual[key]) !== JSON.stringify(m[key]))
          throw Error("Local policy changed: " + m.id + " " + key);
    }
    for (const d of review.decisions.filter((d) => d.state === "approved")) {
      const source = sources.find((e) => e.id === d.entry_id)!;
      const link =
        d.target_kind === "exercise"
          ? g.movements.find((e) => e.id === d.target_id)?.codexReference
          : g.codexFormats?.find((f) => f.id === d.target_id)?.reference;
      if (
        !link ||
        link.officialId !== source.id ||
        link.name !== source.name ||
        (d.relation === "equivalent"
          ? link.description !== source.description
          : link.description !== null)
      )
        throw Error("Reference mismatch " + d.target_id);
    }
    roles.push({
      role,
      canonicalCount: c.ex_exercises.length,
      exerciseLinks: g.codexIds?.length,
      formatLinks: g.codexFormats?.length,
      completeLocalPolicyAndSourceParity: true,
    });
    await db.exec("reset role");
  }
  await db.exec(
    readFileSync("supabase/rollback/reviewed_codex_planner_links.sql", "utf8"),
  );
  const report = {
    ...prepared.report,
    roles,
    repeatUnchanged: true,
    rollbackPreservesCanonicalRows:
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from ex_exercises",
        )
      ).rows[0].n === 50,
    aiCalls: 0,
  };
  mkdirSync("qa/exicon-planning", { recursive: true });
  writeFileSync(
    "qa/exicon-planning/local-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await db.close();
}
