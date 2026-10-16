import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { fallbackPlan } from "../src/fallback";
import { plannerRequestSchema } from "../src/planner-contract";
it("cloud vault scopes plans to a private code and rejects stale writes and direct table access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create table public.beatdowns(id text); grant all on public.beatdowns to anon,authenticated;",
    );
    await db.exec(
      await readFile(new URL("../docs/plan-sync.sql", import.meta.url), "utf8"),
    );
    const w = fallbackPlan(
      plannerRequestSchema.parse({
        prompt: "Bodyweight circuit",
        strictSchedule: true,
        equipment: "None",
      }),
    ).workout;
    const a = "a".repeat(64),
      b = "b".repeat(64);
    await db.exec("set role anon");
    const call = async (
      code: string,
      operation: string,
      version = 0,
      payload: unknown[] = [],
    ) =>
      (
        await db.query<{ result: { version: number; workouts: unknown[] } }>(
          "select public.fe_sync_plans($1,$2,$3,$4::jsonb) as result",
          [code, operation, version, JSON.stringify(payload)],
        )
      ).rows[0].result;
    expect(await call(a, "get")).toEqual({ version: 0, workouts: [] });
    expect((await call(a, "put", 0, [w])).version).toBe(1);
    expect((await call(b, "get")).workouts).toEqual([]);
    expect((await call(a, "get")).workouts).toEqual([w]);
    await expect(call(a, "put", 0, [])).rejects.toThrow("Cloud changed");
    await expect(call(a, "put", 1, [{ ...w, kind: "source" }])).rejects.toThrow(
      "Invalid personal",
    );
    await expect(call(a, "put", 1, [w, w])).rejects.toThrow("Duplicate IDs");
    await expect(
      db.query("select * from fe_private.fe_plan_vault"),
    ).rejects.toThrow("permission denied");
    await expect(db.query("delete from public.beatdowns")).rejects.toThrow(
      "permission denied",
    );
    expect((await call(a, "put", 1, [])).version).toBe(2);
    expect((await call(a, "get")).workouts).toEqual([]);
  } finally {
    await db.close();
  }
}, 20000);
