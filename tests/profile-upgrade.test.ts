import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { newWorkout } from "../src/model";
import { attributeWorkout } from "../src/attribution";
it("applies the atomic profile upgrade to existing guest/account stores without changing saved plans", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema extensions;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create table public.beatdowns(id text);
   -- PGlite has no pg_jsonschema. The generated JSON schema has separate parity tests;
   -- this shim lets the real SQL control flow, constraints and upgrade execute locally.
   create function extensions.jsonb_matches_schema(schema json, item jsonb) returns boolean language sql immutable as $$select item->>'kind'='personal'$$;`);
    await db.exec(
      await readFile(new URL("../docs/plan-sync.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      `create function fe_private.valid_plan_payload(payload jsonb) returns boolean language sql immutable as $$select jsonb_typeof(payload)='array'$$;`,
    );
    await db.exec(
      await readFile(
        new URL("../docs/account-plan-sync.sql", import.meta.url),
        "utf8",
      ),
    );
    const owner = "11111111-1111-4111-8111-111111111111";
    const old = newWorkout();
    await db.query("insert into auth.users values($1)", [owner]);
    await db.query(
      "insert into fe_private.fe_account_vault(user_id,workouts) values($1,$2)",
      [owner, JSON.stringify([old])],
    );
    await db.query(
      "insert into fe_private.fe_plan_vault(key_hash,workouts) values('fixture',$1)",
      [JSON.stringify([old])],
    );
    await db.exec(
      await readFile(
        new URL("../docs/profile-release.sql", import.meta.url),
        "utf8",
      ),
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
    for (const table of ["fe_account_vault", "fe_plan_vault"]) {
      const result = (
        await db.query<{ workouts: unknown[] }>(
          `select workouts from fe_private.${table}`,
        )
      ).rows[0];
      expect(result.workouts).toEqual([old]);
    }
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.query(
      "insert into public.fe_profiles(user_id,display_name) values($1,'Rug Burn')",
      [owner],
    );
    const attributed = attributeWorkout(old, owner, "Rug Burn");
    const updated = (
      await db.query<{ result: { workouts: unknown[]; version: number } }>(
        "select public.fe_account_plans('put',1,$1) as result",
        [JSON.stringify([attributed])],
      )
    ).rows[0].result;
    expect(updated.version).toBe(2);
    expect(updated.workouts).toEqual([attributed]);
    await db.exec("set role anon");
    await expect(db.query("select * from public.fe_profiles")).rejects.toThrow(
      "permission denied",
    );
  } finally {
    await db.close();
  }
}, 20000);
