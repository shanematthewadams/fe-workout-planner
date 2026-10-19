import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import { workoutSchema } from "../src/model";
it("keeps the database payload schema generated from the actual workout contract", async () => {
  const schema = zodToJsonSchema(workoutSchema, {
    name: "Workout",
    $refStrategy: "none",
  });
  const expected = JSON.parse(
    await readFile(
      new URL("../docs/workout-sync.schema.json", import.meta.url),
      "utf8",
    ),
  );
  const personalSchema = JSON.parse(JSON.stringify(schema));
  personalSchema.definitions.Workout.properties.kind = { const: "personal" };
  expect(expected).toEqual(personalSchema);
  const sql = await readFile(
    new URL("../docs/plan-sync-hardening.sql", import.meta.url),
    "utf8",
  );
  expect(sql).toContain(JSON.stringify(expected));
  expect(sql).toContain("not valid");
});
it("generates one atomic upgrade without duplicating existing vault constraints", async () => {
  const sql = await readFile(
    new URL("../docs/profile-release.sql", import.meta.url),
    "utf8",
  );
  const validator = await readFile(
    new URL("../docs/plan-sync-hardening.sql", import.meta.url),
    "utf8",
  );
  const profile = await readFile(
    new URL("../docs/user-profiles.sql", import.meta.url),
    "utf8",
  );
  expect(sql).toContain(
    validator
      .replace(/^create extension[^\n]*\n/m, "")
      .replace(
        /^alter table fe_private\.fe_plan_vault add constraint[^\n]*\n/m,
        "",
      ),
  );
  expect(sql).toContain(
    profile.replace(/^begin;\n/m, "").replace(/^commit;\n/m, ""),
  );
  expect(sql.match(/^begin;/gm)).toHaveLength(1);
  expect(sql.match(/^commit;/gm)).toHaveLength(1);
  expect(sql).not.toContain("add constraint valid_workout_payload");
  expect(sql).not.toMatch(
    /delete from|truncate|update fe_private\.fe_(account|plan)_vault/i,
  );
});

it("uses explicit UUID patterns because the hosted validator does not assert format labels", async () => {
  const schema = JSON.parse(
    await readFile(
      new URL("../docs/workout-sync.schema.json", import.meta.url),
      "utf8",
    ),
  );
  const attribution =
    schema.definitions.Workout.properties.attribution.properties;
  for (const field of [
    attribution.ownerId,
    attribution.creatorId,
    attribution.adaptedFrom.properties.creatorId,
  ]) {
    expect(field.format).toBe("uuid");
    expect(
      new RegExp(field.pattern).test("11111111-1111-4111-8111-111111111111"),
    ).toBe(true);
    expect(new RegExp(field.pattern).test("not-a-uuid")).toBe(false);
  }
});
