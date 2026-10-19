import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { fallbackPlan } from "../src/fallback";
import { plannerRequestSchema } from "../src/planner-contract";
it("keeps the prepared staging vault separate, code-scoped and concurrency checked without altering production", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create table public.beatdowns(id text); grant all on public.beatdowns to anon,authenticated;",
    );
    await db.exec(
      await readFile(new URL("../docs/plan-sync.sql", import.meta.url), "utf8"),
    );
    // PGlite does not ship pg_jsonschema: test isolation/CAS/permissions here, schema parity separately.
    await db.exec(
      "create schema extensions; create function extensions.jsonb_matches_schema(json,jsonb) returns boolean language sql immutable as 'select true';",
    );
    const sql = await readFile(
      new URL("../docs/staging-plan-sync.sql", import.meta.url),
      "utf8",
    );
    expect(sql).not.toContain("public.beatdowns");
    expect(sql).not.toContain("fe_private.fe_plan_vault");
    await db.exec(sql);
    const w = fallbackPlan(
      plannerRequestSchema.parse({
        prompt: "Bodyweight circuit",
        equipment: "None",
        strictSchedule: true,
      }),
    ).workout;
    const token = "f".repeat(64);
    await db.exec("set role anon");
    const call = async (
      rpc: string,
      op: string,
      version = 0,
      payload: unknown[] = [],
    ) =>
      (
        await db.query<{ result: { version: number; workouts: unknown[] } }>(
          `select public.${rpc}($1,$2,$3,$4::jsonb) as result`,
          [token, op, version, JSON.stringify(payload)],
        )
      ).rows[0].result;
    await call("fe_sync_plans", "put", 0, [w]);
    expect((await call("fe_staging_sync_plans", "get")).workouts).toEqual([]);
    await call("fe_staging_sync_plans", "put", 0, [
      { ...w, title: "Staging only" },
    ]);
    expect((await call("fe_sync_plans", "get")).workouts).toEqual([w]);
    await expect(call("fe_staging_sync_plans", "put", 0, [])).rejects.toThrow(
      "Cloud changed",
    );
    await expect(
      db.query("select * from fe_staging_private.fe_plan_vault"),
    ).rejects.toThrow("permission denied");
  } finally {
    await db.close();
  }
}, 20000);
