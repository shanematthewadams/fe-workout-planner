import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { catalog } from "../src/catalog";
it("prepared SQL exposes only approved published records and denies anonymous mutations (isolated Postgres)", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role;",
    );
    await db.exec(
      await readFile(
        new URL("../docs/catalog-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const [id, approved, published] of [
      ["shown", true, true],
      ["unpublished", true, false],
      ["unapproved", false, false],
    ] as const) {
      await db.query(
        "insert into public.workouts(id,data,approved,published) values ($1,$2,$3,$4)",
        [id, { ...catalog[0], id }, approved, published],
      );
    }
    await expect(
      db.query(
        "insert into public.workouts(id,data,published) values ($1,$2,true)",
        ["bad", { ...catalog[0], id: "bad" }],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.workouts(id,data) values ($1,$2)", [
        "malformed",
        {},
      ]),
    ).rejects.toThrow();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      const result = await db.query("select id from public.workouts");
      expect(result.rows).toEqual([{ id: "shown" }]);
      expect(
        (
          await db.query(
            "select id from public.workouts where id='unpublished'",
          )
        ).rows,
      ).toEqual([]);
      for (const statement of [
        "insert into public.workouts(id,data) values ('anonymous','{}')",
        "update public.workouts set published=false",
        "delete from public.workouts",
      ]) {
        await expect(db.exec(statement)).rejects.toThrow(/permission denied/);
      }
      await db.exec("reset role");
    }
    expect(
      (await db.query("select count(*)::int as n from public.workouts")).rows,
    ).toEqual([{ n: 3 }]);
  } finally {
    await db.close();
  }
}, 20000);
