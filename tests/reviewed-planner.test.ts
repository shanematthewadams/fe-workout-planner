import { expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import productionReview from "../data/codex-planner-review.json";
import {
  prepareReviewedPlanner,
  definitionFingerprint,
} from "../scripts/reviewed-planner.ts";
import { buildAppExicon, exiconImportSQL } from "../scripts/exicon-catalog.ts";
import { plannerExiconSchema } from "../src/codex-planner.ts";
import { exiconCatalogSchema } from "../src/exicon-catalog.ts";
import { movements } from "../src/movements.ts";
import { adaptExicon } from "../server/exicon-intelligence.ts";
import { contextFor } from "../server/planner-context.ts";
import { handlePlanner } from "../server/planner-handler.ts";
import { fallbackPlan } from "../src/fallback.ts";
import { plannerRequestSchema } from "../src/planner-contract.ts";
const review = structuredClone(productionReview);
for (const d of review.decisions)
  if (d.state === "approved")
    d.entry_text_fingerprint = definitionFingerprint({
      name: "Source " + d.target_id,
      description: "Reviewed official fixture " + d.target_id,
    });
const sources = () =>
  review.decisions
    .filter((d) => d.state === "approved")
    .map((d) => ({
      id: d.entry_id!,
      name: "Source " + d.target_id,
      description: "Reviewed official fixture " + d.target_id,
      fingerprint: d.entry_fingerprint!,
    }));
const q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
async function setup(source = sources()) {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;",
  );
  for (const file of [
    "20261025175228_ao_intelligence_foundation.sql",
    "20261026015007_exicon_foundation.sql",
    "20261026143249_exicon_read_snapshot.sql",
    "20261104153007_codex_reference_catalog.sql",
    "20261110192426_reviewed_codex_planner_links.sql",
    "20261110194102_bind_reviewed_source_text.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    "insert into ao_amenity_types values('benches','Benches'),('workout-walls','Walls'),('pull-up-bars','Bars');",
  );
  await db.exec(exiconImportSQL(buildAppExicon()));
  await db.exec(
    "insert into ao_sources values('codex-fixture','nation','https://codex.f3nation.com/api/exicon','2026-11-04','Fixture source');insert into ex_codex_reuse(source_id,decision_id,decided_by,decided_at,basis,upstream_permission,rationale,enabled) values('codex-fixture','fixture','Engineering','2026-11-04','product-owner-interpretation','unresolved','Operator fixture for testing the reviewed planner link chain',true)",
  );
  await db.exec(
    "insert into ex_codex_entries(id,name,description,fingerprint,captured_at,source_id) values " +
      source
        .map(
          (e) =>
            `(${q(e.id)},${q(e.name)},${q(e.description)},${q(e.fingerprint)},'2026-11-04','codex-fixture')`,
        )
        .join(","),
  );
  return db;
}
const request = () =>
  plannerRequestSchema.parse({
    prompt: "Use merkins and a plank. No running or coupons.",
    ao: "Downrange",
    equipment: "None",
    running: "None",
    minutes: 45,
    mary: true,
    strictSchedule: true,
  });
it("requires complete explicit fingerprint-bound review and never infers source identity from a familiar name", () => {
  const ready = prepareReviewedPlanner(review, sources());
  expect(ready.report).toMatchObject({
    exercises: 50,
    newExercises: 42,
    links: 36,
    referenceDescriptions: 29,
    exerciseLinks: 35,
    formatLinks: 1,
  });
  expect(ready.report.unmapped).toHaveLength(16);
  const edited = sources();
  edited[0].description = "Manual edit without a new upstream hash";
  expect(() => prepareReviewedPlanner(review, edited)).toThrow(
    /changed or missing/,
  );
  const changed = structuredClone(review);
  changed.decisions[0].app_fingerprint = "a".repeat(64);
  expect(() => prepareReviewedPlanner(changed, sources())).toThrow(
    /App definition changed/,
  );
  const src = sources();
  src[0].fingerprint = "b".repeat(64);
  expect(() => prepareReviewedPlanner(review, src)).toThrow(
    /changed or missing/,
  );
  const missing = structuredClone(review);
  missing.decisions.pop();
  expect(() => prepareReviewedPlanner(missing, sources())).toThrow(
    /Every current/,
  );
  const duplicate = structuredClone(review);
  duplicate.decisions.push(duplicate.decisions[0]);
  expect(() => prepareReviewedPlanner(duplicate, sources())).toThrow(
    /Duplicate review/,
  );
  expect(() => prepareReviewedPlanner(review, sources().slice(1))).toThrow(
    /changed or missing/,
  );
});
it("publishes all fifty without changing the original eight, repeats safely and hides stale source/mechanics/counting/facility/format reviews under real RLS", async () => {
  const db = await setup();
  try {
    const original = JSON.stringify(
      (await db.query("select * from ex_exercises order by id")).rows,
    );
    const prepared = prepareReviewedPlanner(review, sources());
    await db.exec(prepared.sql);
    expect(
      JSON.stringify(
        (
          await db.query(
            "select * from ex_exercises where source_id='f3-q-builder-app-exercises-v1' order by id",
          )
        ).rows,
      ),
    ).toBe(original);
    const before = JSON.stringify(
      (await db.query("select * from ex_codex_planner_links order by id")).rows,
    );
    await db.exec(prepared.sql);
    expect(
      JSON.stringify(
        (await db.query("select * from ex_codex_planner_links order by id"))
          .rows,
      ),
    ).toBe(before);
    // Simulate the one-time upgrade: old links receive a null new review field.
    await db.exec(
      "update ex_codex_planner_links set entry_text_fingerprint=null",
    );
    expect(
      (
        await db.query<{ d: { codex_links: unknown[] } }>(
          "select fe_exicon_planner_catalog() d",
        )
      ).rows[0].d.codex_links,
    ).toHaveLength(0);
    await db.exec(prepared.sql);
    expect(
      JSON.stringify(
        (await db.query("select * from ex_codex_planner_links order by id"))
          .rows,
      ),
    ).toBe(before);
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      const c = plannerExiconSchema.parse(
        (await db.query<{ d: unknown }>("select fe_exicon_planner_catalog() d"))
          .rows[0].d,
      );
      expect(c.ex_exercises).toHaveLength(50);
      expect(c.codex_links).toHaveLength(36);
      expect(adaptExicon(c).codexIds).toHaveLength(35);
      expect(
        exiconCatalogSchema.parse(
          (await db.query<{ d: unknown }>("select fe_exicon_catalog() d"))
            .rows[0].d,
        ).ex_exercises,
      ).toHaveLength(50);
      await expect(
        db.exec("update ex_codex_planner_links set enabled=false"),
      ).rejects.toThrow(/permission denied/);
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select has_table_privilege(current_user,'ex_codex_planner_links','INSERT,UPDATE,DELETE,TRUNCATE') ok",
          )
        ).rows[0].ok,
      ).toBe(false);
      await db.exec("reset role");
    }
    const snapshot = async () => {
      await db.exec("set role anon");
      const c = plannerExiconSchema.parse(
        (await db.query<{ d: unknown }>("select fe_exicon_planner_catalog() d"))
          .rows[0].d,
      );
      await db.exec("reset role");
      return c;
    };
    const c = await snapshot(),
      guide = adaptExicon(c);
    for (const m of movements) {
      const live = guide.movements.find((l) => l.id === m.id)!;
      expect(live.instructions).toBe(m.instructions);
      expect(live.equipment).toEqual(m.equipment);
      expect(live.features).toEqual(m.features);
      expect(live.running).toBe(m.running);
      expect(live.counting).toContain(m.counting);
      expect(live.alternative).toBe(m.alternative);
    }
    expect(
      guide.movements.find((m) => m.id === "dying-cockroach")!.codexReference
        ?.description,
    ).toBeNull();
    expect(
      guide.movements.find((m) => m.id === "merkin")!.codexReference
        ?.description,
    ).toContain("official fixture");
    const context = contextFor(request(), undefined, guide);
    expect(
      context.exercises.find((e) => e.name === "Merkin")?.codexReference
        ?.officialId,
    ).toBe(review.decisions.find((d) => d.target_id === "merkin")!.entry_id);
    expect(context.formatGuide).toHaveLength(1);
    await db.exec(
      "begin;update ex_codex_entries set description='Manual source edit' where id=" +
        q(review.decisions.find((d) => d.target_id === "merkin")!.entry_id!),
    );
    expect((await snapshot()).codex_links).toHaveLength(35);
    await db.exec("rollback");
    // Source-only changes withdraw the reference, not local mechanics or saved names.
    const entry = review.decisions.find(
      (d) => d.target_id === "merkin",
    )!.entry_id!;
    await db.exec(
      `update ex_codex_entries set fingerprint=repeat('f',64) where id=${q(entry)}`,
    );
    expect((await snapshot()).codex_links).toHaveLength(35);
    await db.exec(
      "update ex_exercises set instructions='Local edited mechanics' where id='wall-sit'",
    );
    expect((await snapshot()).codex_links).toHaveLength(34);
    await db.exec(
      "update ex_counting_conventions set cycle_description='Updated local cycle' where exercise_id='flutter-kick'",
    );
    expect((await snapshot()).codex_links).toHaveLength(33);
    await db.exec(
      "insert into ex_exercise_facilities values('imperial-walker','workout-walls',true)",
    );
    expect((await snapshot()).codex_links).toHaveLength(32);
    await db.exec(
      "update ex_format_parameters set maximum=10 where format_id='11s' and parameter_key='pair_total'",
    );
    expect((await snapshot()).codex_links).toHaveLength(31);
    // A repeat importer may not rubber-stamp locally changed rows or silently reapprove stale reviews.
    await expect(db.exec(prepared.sql)).rejects.toThrow();
    await db.exec("rollback");
    await db.exec("update ex_codex_reuse set enabled=false");
    const revoked = await snapshot();
    expect(revoked.codex_links).toEqual([]);
    expect(revoked.ex_exercises).toHaveLength(50);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/rollback/reviewed_codex_planner_links.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      (await db.query("select count(*)::int n from ex_exercises")).rows,
    ).toEqual([{ n: 50 }]);
  } finally {
    await db.close();
  }
}, 30000);
it("sends reviewed source references through the shared generation handler in the same provider call, while app rules and unknown site availability remain authoritative", async () => {
  const db = await setup();
  try {
    await db.exec(prepareReviewedPlanner(review, sources()).sql);
    await db.exec("set role anon");
    const catalog = plannerExiconSchema.parse(
      (await db.query<{ d: unknown }>("select fe_exicon_planner_catalog() d"))
        .rows[0].d,
    );
    await db.exec("reset role");
    const input = request(),
      good = fallbackPlan(input).plan;
    const provider = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "fixture:free",
          choices: [{ message: { content: JSON.stringify(good) } }],
        }),
      ),
    );
    const read = vi.fn(async () => catalog);
    const result = await handlePlanner(
      new Request("https://app.invalid/api/plan-workout", {
        method: "POST",
        headers: {
          Origin: "https://app.invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
      {
        exicon: {
          enabled: "true",
          url: "https://fixture.supabase.co",
          publishableKey: "sb_publishable_fixture",
        },
        OPENROUTER_API_KEY: "fixture",
      },
      provider,
      async () => null,
      read,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("X-F3-Codex-Links")).toBe("35");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
    const body = String(provider.mock.calls[0][1]?.body);
    expect(body).toContain("Reviewed official fixture merkin");
    expect(body).toContain("App instructions, counting");
    const context = contextFor(input, undefined, adaptExicon(catalog));
    expect(context.exercises.some((e) => e.name === "Derkin")).toBe(false);
    expect(context.exercises.some((e) => e.name === "Blockee")).toBe(false);
  } finally {
    await db.close();
  }
}, 30000);
it("rejects duplicate links and adaptations carrying foreign mechanics in the wire payload", () => {
  const base = prepareReviewedPlanner(review, sources()).catalog;
  const l = {
    exercise_id: "merkin",
    format_id: null,
    entry_id: "official",
    entry_name: "Source",
    description: "Source mechanics",
    relation: "local-adaptation",
    review_note: "Retain local mechanics",
    reviewed_at: "2026-11-10T00:00:00Z",
  };
  expect(() =>
    plannerExiconSchema.parse({ ...base, codex_links: [l] }),
  ).toThrow();
  l.relation = "equivalent";
  expect(() =>
    plannerExiconSchema.parse({ ...base, codex_links: [l, l] }),
  ).toThrow();
});
