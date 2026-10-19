import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { newWorkout } from "../src/model";

it("account RPC requires verified ownership, isolates accounts and rejects guest access and stale writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      create table public.beatdowns(id text);`);
    await db.exec(
      await readFile(new URL("../docs/plan-sync.sql", import.meta.url), "utf8"),
    );
    // PGlite lacks pg_jsonschema. Production uses the existing full validator;
    // this test concentrates on ownership and optimistic write permissions.
    await db.exec(`create function fe_private.valid_plan_payload(payload jsonb) returns boolean language sql immutable as $$
      select jsonb_typeof(payload)='array' and jsonb_array_length(payload)<=200
      and not exists(select 1 from jsonb_array_elements(payload) w where w->>'kind' is distinct from 'personal') $$;`);
    await db.exec(
      await readFile(
        new URL("../docs/account-plan-sync.sql", import.meta.url),
        "utf8",
      ),
    );
    const a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users(id) values($1),($2)", [a, b]);
    const call = async (
      operation = "get",
      version = 0,
      payload: unknown[] = [],
    ) =>
      (
        await db.query<{ result: { version: number; workouts: unknown[] } }>(
          "select public.fe_account_plans($1,$2,$3::jsonb) as result",
          [operation, version, JSON.stringify(payload)],
        )
      ).rows[0].result;
    await db.exec("set role anon");
    await expect(call()).rejects.toThrow("permission denied");
    await db.exec("set role authenticated");
    await expect(call()).rejects.toThrow("Sign in required");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    expect(await call()).toEqual({ version: 0, workouts: [] });
    const w = newWorkout();
    expect((await call("put", 0, [w])).version).toBe(1);
    await expect(call("put", 0, [])).rejects.toThrow("Account changed");
    await expect(call("put", 1, [{ ...w, kind: "source" }])).rejects.toThrow(
      "Invalid personal",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    expect(await call()).toEqual({ version: 0, workouts: [] });
    expect((await call("put", 0, [])).version).toBe(1);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    expect((await call()).workouts).toEqual([w]);
    await expect(
      db.query("select * from fe_private.fe_account_vault"),
    ).rejects.toThrow("permission denied");
    // Account data cannot be reached through the existing guest capability RPC.
    const guest = (
      await db.query<{ result: { workouts: unknown[] } }>(
        "select public.fe_sync_plans($1,'get') as result",
        [a.replaceAll("-", "").repeat(2)],
      )
    ).rows[0].result;
    expect(guest.workouts).toEqual([]);
    // Even if a future grant exposes the private table, RLS still scopes ownership.
    await db.exec(
      "reset role; grant select on fe_private.fe_account_vault to authenticated; set role authenticated;",
    );
    expect(
      (
        await db.query<{ user_id: string }>(
          "select user_id from fe_private.fe_account_vault",
        )
      ).rows,
    ).toEqual([{ user_id: a }]);
  } finally {
    await db.close();
  }
}, 20000);
