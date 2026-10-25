import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
it("captures an operator-only recoverable app snapshot without altering original rows or permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;create role service_role;create schema fe_private;
   create table public.workouts(id text primary key,data jsonb);insert into workouts values('source','{"kind":"source"}');
   create table public.beatdowns(id text primary key);create table public.fe_profiles(user_id text primary key);insert into fe_profiles values('owner');
   create table fe_private.fe_plan_vault(key_hash text primary key,workouts jsonb);insert into fe_private.fe_plan_vault values('private-hash','[{"id":"saved-plan"}]');
   create table fe_private.fe_account_vault(user_id text primary key,workouts jsonb);
   grant select on public.workouts to anon;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261025233626_snapshot_before_ao_catalog.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      (
        await db.query(
          "select count(*)::int as n from fe_ao_preflight_backup.manifest",
        )
      ).rows,
    ).toEqual([{ n: 5 }]);
    expect(
      (
        await db.query(
          "select * from fe_ao_preflight_backup.fe_private_fe_plan_vault",
        )
      ).rows,
    ).toEqual((await db.query("select * from fe_private.fe_plan_vault")).rows);
    expect((await db.query("select * from fe_profiles")).rows).toEqual([
      { user_id: "owner" },
    ]);
    for (const role of ["anon", "authenticated", "service_role"]) {
      await db.exec("set role " + role);
      await expect(
        db.query("select * from fe_ao_preflight_backup.manifest"),
      ).rejects.toThrow(/permission denied/);
      if (role === "anon")
        expect((await db.query("select id from public.workouts")).rows).toEqual(
          [{ id: "source" }],
        );
      await db.exec("reset role");
    }
    expect(
      (
        await db.query(
          "select tablename from pg_tables where schemaname='fe_ao_preflight_backup' and not rowsecurity",
        )
      ).rows,
    ).toEqual([]);
  } finally {
    await db.close();
  }
}, 20000);
