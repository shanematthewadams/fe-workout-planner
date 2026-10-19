import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { attributeWorkout } from "../src/attribution";
import { newWorkout, copyWorkout, writeState, readState } from "../src/model";
import { profileFieldsSchema } from "../src/profile";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
it("keeps creator snapshots on adaptation while assigning private workspace ownership", () => {
  const original = attributeWorkout(newWorkout(), a, "Rug Burn");
  const copy = attributeWorkout(copyWorkout(original), b, "Another Q");
  expect(copy.attribution).toMatchObject({
    ownerId: b,
    creatorId: a,
    creatorDisplayName: "Rug Burn",
    visibility: "private",
    adaptedFrom: { workoutId: original.id, creatorId: a },
  });
  expect(
    attributeWorkout(original, a, "Changed Name").attribution?.creatorId,
  ).toBe(a);
  expect(original.attribution?.ownerId).toBe(a);
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
  };
  writeState({ workouts: [copy], favorites: [] }, storage);
  expect(readState(storage).workouts[0]).toEqual(copy);
  expect(JSON.stringify(copy)).not.toContain("email");
});
it("accepts F3 names and optional region/AO; rejects blank or oversized names", () => {
  expect(
    profileFieldsSchema.parse({ display_name: "  Rug Burn  " }).display_name,
  ).toBe("Rug Burn");
  expect(profileFieldsSchema.safeParse({ display_name: "  " }).success).toBe(
    false,
  );
  expect(
    profileFieldsSchema.safeParse({ display_name: "a".repeat(81) }).success,
  ).toBe(false);
});
it("profile RLS isolates reads/writes, timestamps and immutable IDs without public email exposure", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema fe_private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;`);
    await db.exec(
      await readFile(
        new URL("../docs/user-profiles.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1),($2)", [a, b]);
    await db.exec("set role anon");
    await expect(db.query("select * from public.fe_profiles")).rejects.toThrow(
      "permission denied",
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
    await db.query(
      "insert into public.fe_profiles(user_id,display_name,created_at) values($1,' Rug Burn ','2000-01-01')",
      [a],
    );
    let result = (
      await db.query<{ display_name: string; created_at: Date }>(
        "select * from public.fe_profiles",
      )
    ).rows[0];
    expect(result.display_name).toBe("Rug Burn");
    expect(new Date(result.created_at).getFullYear()).toBeGreaterThan(2000);
    const created = result.created_at;
    await db.query(
      "update public.fe_profiles set display_name='Rug Burn II',created_at='2000-01-01' where user_id=$1",
      [a],
    );
    result = (await db.query<typeof result>("select * from public.fe_profiles"))
      .rows[0];
    expect(result.created_at).toEqual(created);
    await expect(
      db.query("update public.fe_profiles set user_id=$1", [b]),
    ).rejects.toThrow("immutable");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
    expect((await db.query("select * from public.fe_profiles")).rows).toEqual(
      [],
    );
    await expect(
      db.query(
        "insert into public.fe_profiles(user_id,display_name) values($1,'Fake')",
        [a],
      ),
    ).rejects.toThrow("row-level security");
    await db.query(
      "insert into public.fe_profiles(user_id,display_name) values($1,'Other')",
      [b],
    );
    expect(
      (await db.query("select * from public.fe_profiles")).rows,
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 20000);
