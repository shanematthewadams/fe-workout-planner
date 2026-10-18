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
