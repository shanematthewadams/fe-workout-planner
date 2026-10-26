import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  buildAppExicon,
  exiconImportSQL,
  validateExiconCatalog,
  EXICON_TABLE_KEYS,
} from "../scripts/exicon-catalog.ts";
import { movements } from "../src/movements";
import { resolveExercise } from "../src/exicon-catalog";
const tables = Object.keys(EXICON_TABLE_KEYS).filter((t) => t !== "ao_sources");
const migration = await readFile(
  new URL(
    "../supabase/migrations/20261026015007_exicon_foundation.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = await readFile(
  new URL("../supabase/rollback/exicon_foundation.sql", import.meta.url),
  "utf8",
);
const catalog = buildAppExicon();
const common = {
  source_id: catalog.ex_source_licenses[0].source_id,
  publication_status: "published" as const,
  revision: 1,
  protected: false,
};
function withVariation() {
  const c = structuredClone(catalog);
  c.ex_variations.push({
    ...common,
    id: "squat-low",
    exercise_id: "squat",
    region_id: "the-fe",
    name: "Low squat",
    instructions: "Synthetic test variation: stop at a comfortable depth.",
    equipment_mode: "replace",
    facility_mode: "replace",
  });
  c.ex_aliases.push({
    ...common,
    id: "regional-low",
    exercise_id: "squat",
    variation_id: "squat-low",
    region_id: "the-fe",
    alias: "Low rider",
  });
  c.ex_counting_conventions.push({
    ...common,
    id: "regional-double",
    exercise_id: "squat",
    variation_id: null,
    region_id: "the-fe",
    convention: "2=1",
    cycle_description:
      "Synthetic regional convention: two complete squat cycles form a rep.",
    count_on: null,
  });
  return c;
}
it("preserves all fifty movement objects byte-for-byte while separating eight app-written descriptions", () => {
  expect(
    createHash("sha256").update(JSON.stringify(movements)).digest("hex"),
  ).toBe("b687db245d5dce69512911cf7a777c29d9b010273b7ea8da714748727eca9ba2");
  expect(catalog.ex_exercises).toHaveLength(8);
  for (const row of catalog.ex_exercises)
    expect(row.instructions).toBe(
      movements.find((m) => m.id === row.id)?.instructions,
    );
  expect(catalog.ex_exercises.some((e) => e.id === "merkin")).toBe(false);
});
it("resolves regional aliases and counting without inventing a variation, equipment or rep convention", () => {
  const c = withVariation();
  const result = resolveExercise(c, "Air squat", "the-fe");
  expect(result.status).toBe("matched");
  if (result.status !== "matched") throw Error("Missing exercise");
  expect(result.variation).toBeNull();
  expect(result.counting.map((c) => c.convention)).toEqual(["2=1"]);
  expect(resolveExercise(c, "Low rider", "other").status).toBe("missing");
  const low = resolveExercise(c, "Low rider", "the-fe");
  expect(low.status === "matched" && low.variation?.id).toBe("squat-low");
  const row = resolveExercise(c, "BOR");
  expect(row.status === "matched" && row.countingNeedsConfirmation).toBe(true);
  expect(row.status === "matched" && row.requirements.equipment).toEqual([
    "coupon",
  ]);
  expect(resolveExercise(c, "boring").status).toBe("missing");
});
it("returns ambiguity and requires explicit variation identity; alias collisions never choose the first match", () => {
  const c = withVariation();
  c.ex_aliases.push({
    ...common,
    id: "collision",
    exercise_id: "plank",
    variation_id: null,
    region_id: null,
    alias: "Air squat",
  });
  expect(resolveExercise(c, "Air squat").status).toBe("ambiguous");
  expect(resolveExercise(c, "Air squat", "the-fe", "squat-low").status).toBe(
    "matched",
  );
  expect(resolveExercise(c, "Air squat", "other", "squat-low").status).toBe(
    "missing",
  );
  const regional = resolveExercise(c, "Squat", "the-fe");
  expect(regional.status === "matched" && regional.variation).toBeNull();
});
it("keeps variation requirements explicit: inherit keeps gear, replace can remove it", () => {
  const c = structuredClone(catalog);
  c.ex_variations.push({
    ...common,
    id: "bodyweight-thruster-test",
    exercise_id: "thruster",
    region_id: null,
    name: "Synthetic bodyweight variation",
    instructions: "Test-only bodyweight movement change.",
    equipment_mode: "replace",
    facility_mode: "inherit",
  });
  const replaced = resolveExercise(
    c,
    "Thruster",
    undefined,
    "bodyweight-thruster-test",
  );
  expect(
    replaced.status === "matched" && replaced.requirements.equipment,
  ).toEqual([]);
  c.ex_variations[0].equipment_mode = "inherit";
  const inherited = resolveExercise(
    c,
    "Thruster",
    undefined,
    "bodyweight-thruster-test",
  );
  expect(
    inherited.status === "matched" && inherited.requirements.equipment,
  ).toEqual(["portable-weight"]);
});
it("rejects malformed/duplicate input and keeps unlicensed/draft content out of resolution", () => {
  const c = structuredClone(catalog);
  c.ex_exercises.push(c.ex_exercises[0]);
  expect(() => validateExiconCatalog(c)).toThrow(/Duplicate/);
  expect(() => exiconImportSQL({ ...catalog, sneaky: "ignored?" })).toThrow();
  const noPermission = structuredClone(catalog);
  noPermission.ex_source_licenses[0].redistribution_allowed = false;
  expect(resolveExercise(noPermission, "squat").status).toBe("missing");
  noPermission.ex_source_licenses[0].redistribution_allowed = true;
  noPermission.ex_exercises.find((e) => e.id === "squat")!.publication_status =
    "draft";
  expect(resolveExercise(noPermission, "Air squat").status).toBe("missing");
});
describe("Exicon relational permissions and safe import", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      "create role anon;create role authenticated;create role service_role;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261025175228_ao_intelligence_foundation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    // Minimal existing AO dependencies and app-owned record sentinels.
    await db.exec(
      "insert into ao_sources values('test-source','review','https://example.com','2026-01-01','test');insert into ao_regions(id,name,source_id) values('the-fe','The FE','test-source');insert into ao_amenity_types values('workout-walls','Workout walls'),('pull-up-bars','Pull-up bars');create table workouts(id text primary key,payload text);insert into workouts values('existing','untouched');create table fe_profiles(id text primary key,name text);insert into fe_profiles values('existing','untouched');",
    );
    await db.exec(migration);
    await db.exec(exiconImportSQL(catalog));
  }, 30000);
  beforeEach(async () => {
    await db.exec("begin;");
  });
  afterEach(async () => {
    await db.exec("rollback;reset role;");
  });
  afterAll(async () => {
    await db?.close();
  });
  async function reject(sql: string, pattern: RegExp) {
    await db.exec("savepoint reject_case;");
    try {
      await expect(db.exec(sql)).rejects.toThrow(pattern);
    } finally {
      await db.exec("rollback to reject_case;release reject_case;");
    }
  }
  it("imports twice with identical rows and reports same-version, protected and older conflicts", async () => {
    // The importer owns its transaction, so leave this test's fixture transaction first.
    await db.exec("rollback;");
    const before = (
      await db.query("select jsonb_agg(e order by id) data from ex_exercises e")
    ).rows;
    const results = await db.exec(exiconImportSQL(catalog));
    expect(results.flatMap((r) => r.rows)).toEqual([]);
    expect(
      (
        await db.query(
          "select jsonb_agg(e order by id) data from ex_exercises e",
        )
      ).rows,
    ).toEqual(before);
    await db.exec(
      "update ex_exercises set name='Operator squat', protected=true where id='squat'",
    );
    const next = structuredClone(catalog);
    next.ex_exercises[0].revision = 2;
    next.ex_exercises.find((e) => e.id === "plank")!.instructions =
      "Same version conflict";
    await db.exec("update ex_exercises set revision=3 where id='ww3'");
    const conflicts = (await db.exec(exiconImportSQL(next))).flatMap(
      (r) => r.rows,
    );
    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ record_key: "squat" }),
        expect.objectContaining({ record_key: "plank" }),
        expect.objectContaining({ record_key: "ww3" }),
      ]),
    );
    expect(
      (await db.query("select name from ex_exercises where id='squat'")).rows,
    ).toEqual([{ name: "Operator squat" }]);
    // Restore the shared baseline deliberately as the test operator.
    await db.exec(
      "delete from ex_format_parameters;delete from ex_formats;delete from ex_exercise_equipment;delete from ex_exercise_facilities;delete from ex_counting_conventions;delete from ex_aliases;delete from ex_exercises;",
    );
    await db.exec(exiconImportSQL(catalog));
    await db.exec("begin;");
  });
  it("reports a conflicting source instead of overwriting the current canonical record", async () => {
    await db.exec(
      "insert into ao_sources values('alternate','review','https://example.com','2026-01-01','test');insert into ex_source_licenses values('alternate','Synthetic test permission','https://example.com','2026-01-01',true);update ex_exercises set source_id='alternate' where id='squat'",
    );
    const next = structuredClone(catalog);
    next.ex_exercises.find((e) => e.id === "squat")!.revision = 10;
    const sql = exiconImportSQL(next)
      .replace(/^begin;/, "savepoint source_import;")
      .replace(/commit;$/, "release source_import;");
    const conflicts = (await db.exec(sql)).flatMap((r) => r.rows);
    expect(conflicts).toContainEqual(
      expect.objectContaining({
        table_name: "ex_exercises",
        record_key: "squat",
      }),
    );
    expect(
      (await db.query("select source_id from ex_exercises where id='squat'"))
        .rows,
    ).toEqual([{ source_id: "alternate" }]);
  });
  it("enforces publication licensing, canonical/variation identity, alias normalization and counting constraints", async () => {
    await db.exec("update ex_source_licenses set redistribution_allowed=false");
    await reject(
      "update ex_exercises set revision=2 where id='squat'",
      /source permission/,
    );
    await db.exec("update ex_source_licenses set redistribution_allowed=true");
    await db.exec(
      "insert into ex_variations(id,exercise_id,name,instructions,source_id,publication_status,region_id) values('v','squat','Test variation','Test-only', 'f3-q-builder-app-exercises-v1','published','the-fe')",
    );
    await reject(
      "insert into ex_aliases(id,exercise_id,variation_id,alias,source_id,publication_status,region_id) values('bad','plank','v','Bad','f3-q-builder-app-exercises-v1','published','the-fe')",
      /variation|foreign key/,
    );
    await reject(
      "insert into ex_aliases(id,exercise_id,variation_id,alias,source_id,publication_status) values('bad','squat','v','Bad','f3-q-builder-app-exercises-v1','published')",
      /regional scope/,
    );
    await reject(
      "insert into ex_aliases(id,exercise_id,alias,source_id) values('duplicate','squat','AIR--SQUAT','f3-q-builder-app-exercises-v1')",
      /unique/,
    );
    await reject(
      "update ex_counting_conventions set convention='cadence',count_on=null where exercise_id='squat'",
      /check constraint/,
    );
    await reject(
      "update ex_format_parameters set minimum=1.5 where value_type='integer'",
      /check constraint/,
    );
  });
  it("permits only published/licensed parent chains and denies every browser write on every exposed table", async () => {
    await db.exec(
      "update ex_exercises set publication_status='draft' where id='squat'",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      expect((await db.query("select id from ex_exercises")).rows).toHaveLength(
        7,
      );
      expect(
        (await db.query("select id from ex_aliases where exercise_id='squat'"))
          .rows,
      ).toEqual([]);
      expect(
        (
          await db.query(
            "select id from ex_counting_conventions where exercise_id='squat'",
          )
        ).rows,
      ).toEqual([]);
      for (const table of tables) {
        const key =
          EXICON_TABLE_KEYS[table as keyof typeof EXICON_TABLE_KEYS][0];
        await reject(`delete from ${table}`, /permission denied/);
        await reject(`update ${table} set ${key}=${key}`, /permission denied/);
        const cols = (
          await db.query<{ attname: string }>(
            "select attname from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum",
            [table],
          )
        ).rows
          .map((r) => r.attname)
          .join(",");
        await reject(
          `insert into ${table} (${cols}) select ${cols} from ${table} limit 1`,
          /permission denied/,
        );
      }
      await db.exec("reset role");
    }
    expect(
      (
        await db.query(
          "select relname from pg_class where relname like 'ex_%' and relkind='r' and not relrowsecurity",
        )
      ).rows,
    ).toEqual([]);
    await db.exec(
      "set role service_role;update ex_exercises set name='Authorized operator' where id='squat';reset role;",
    );
    expect(
      (await db.query("select name from ex_exercises where id='squat'")).rows,
    ).toEqual([{ name: "Authorized operator" }]);
  });
  it("license revocation immediately hides descendants and repeat import never restores a permission decision", async () => {
    await db.exec(
      "rollback;update ex_source_licenses set redistribution_allowed=false;",
    );
    const r = await db.exec(exiconImportSQL(catalog)).catch((e) => e);
    // Triggered publication is refused before ON CONFLICT can silently restore content.
    expect(r).toBeInstanceOf(Error);
    await db.exec("rollback;set role anon;");
    for (const table of [
      "ex_source_licenses",
      "ex_exercises",
      "ex_aliases",
      "ex_counting_conventions",
      "ex_exercise_equipment",
      "ex_formats",
      "ex_format_parameters",
    ])
      expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
    await db.exec(
      "reset role;update ex_source_licenses set redistribution_allowed=true;begin;",
    );
  });
  it("rolls back/reapplies only Exicon objects and preserves existing workout/profile/AO data", async () => {
    await db.exec("rollback;");
    await db.exec(rollback);
    expect((await db.query("select * from workouts")).rows).toEqual([
      { id: "existing", payload: "untouched" },
    ]);
    expect((await db.query("select * from fe_profiles")).rows).toEqual([
      { id: "existing", name: "untouched" },
    ]);
    expect((await db.query("select id from ao_regions")).rows).toEqual([
      { id: "the-fe" },
    ]);
    await db.exec(migration);
    await db.exec(exiconImportSQL(catalog));
    expect((await db.query("select id from ex_exercises")).rows).toHaveLength(
      8,
    );
    await db.exec("begin;");
  });
});
