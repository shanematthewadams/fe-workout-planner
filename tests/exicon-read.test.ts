import { expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { buildAppExicon, exiconImportSQL } from "../scripts/exicon-catalog.ts";
import { exiconCatalogSchema, resolveExercise } from "../src/exicon-catalog";
import { movements } from "../src/movements";
import {
  adaptExicon,
  createExiconReader,
  handleExicon,
  exiconEnvironment,
  movementGuide,
} from "../server/exicon-intelligence";
import { contextFor } from "../server/planner-context";
import {
  resolveRequest,
  validatePlan,
  generatePlan,
} from "../server/planner-service";
import { handlePlanner } from "../server/planner-handler";
import { fallbackPlan } from "../src/fallback";
import { siteContext } from "../src/ao-context";
const env = {
  enabled: "true",
  url: "https://catalog.invalid",
  publishableKey: "sb_publishable_fixture",
};
const input = () =>
  resolveRequest({
    prompt: "Bodyweight squats and plank",
    ao: "Unknown AO",
    equipment: "None",
    running: "None",
    strictSchedule: true,
  });
const common = {
  source_id: "f3-q-builder-app-exercises-v1",
  publication_status: "published" as const,
  revision: 1,
  protected: false,
};
it("reads a caller-RLS snapshot with real Postgres timestamp offsets, and a revoked license hides every affected chain", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;",
    );
    for (const file of [
      "20261025175228_ao_intelligence_foundation.sql",
      "20261026015007_exicon_foundation.sql",
      "20261026143249_exicon_read_snapshot.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "insert into ao_amenity_types values('workout-walls','Walls'),('pull-up-bars','Bars')",
    );
    await db.exec(exiconImportSQL(buildAppExicon()));
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      const data = (
        await db.query<{ data: unknown }>(
          "select public.fe_exicon_catalog() data",
        )
      ).rows[0].data;
      const catalog = exiconCatalogSchema.parse(data);
      expect(catalog.ex_exercises).toHaveLength(8);
      expect(catalog.ex_aliases).toHaveLength(15);
      expect(adaptExicon(catalog).databaseIds).toHaveLength(8);
      await db.exec("reset role");
    }
    await db.exec(
      "update ex_source_licenses set redistribution_allowed=false;set role anon;",
    );
    const data = (
      await db.query<{ data: unknown }>(
        "select public.fe_exicon_catalog() data",
      )
    ).rows[0].data;
    const c = exiconCatalogSchema.parse(data);
    expect(c.ex_exercises).toEqual([]);
    expect(c.ex_aliases).toEqual([]);
    expect(c.ex_formats).toEqual([]);
    await db.exec("reset role;");
    expect(
      (
        await db.query(
          "select prosecdef,provolatile from pg_proc where proname='fe_exicon_catalog'",
        )
      ).rows,
    ).toEqual([{ prosecdef: false, provolatile: "s" }]);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/rollback/exicon_read_snapshot.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(
      (await db.query("select count(*)::int n from ex_exercises")).rows,
    ).toEqual([{ n: 8 }]);
  } finally {
    await db.close();
  }
}, 30000);
it("coalesces one snapshot, honors the TTL and never caches failure or malformed responses", async () => {
  let now = 0;
  const f = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify(buildAppExicon())));
  // Each fetch needs a fresh response body.
  f.mockImplementation(
    async () => new Response(JSON.stringify(buildAppExicon())),
  );
  const read = createExiconReader(f, () => now);
  await Promise.all([read(env), read(env)]);
  expect(f).toHaveBeenCalledTimes(1);
  await read(env);
  expect(f).toHaveBeenCalledTimes(1);
  now = 60001;
  f.mockImplementation(async () => new Response("<html>fallback</html>"));
  expect(await read(env)).toBeNull();
  expect(await read(env)).toBeNull();
  expect(f).toHaveBeenCalledTimes(3);
  f.mockImplementation(
    async () => new Response(JSON.stringify(buildAppExicon())),
  );
  expect(await read(env)).not.toBeNull();
  expect(f.mock.calls[0][0].toString()).toContain("/rpc/fe_exicon_catalog");
});
it("merges eight stable identities with all fifty fallback movements and preserves legacy names after a rename", () => {
  const c = buildAppExicon();
  c.ex_exercises.find((e) => e.id === "squat")!.name = "Controlled squat";
  const guide = adaptExicon(c);
  expect(guide.movements).toHaveLength(50);
  expect(guide.databaseIds).toHaveLength(8);
  expect(guide.movements.find((m) => m.id === "squat")?.aliases).toContain(
    "Squat",
  );
  expect(
    guide.movements.find((m) => m.id === "mountain-climber")?.counting,
  ).toContain("Q must choose");
  expect(movements.find((m) => m.id === "squat")?.name).toBe("Squat");
});
it("uses regional aliases/counting without selecting a variation; exact canonical IDs cannot be hijacked by aliases", () => {
  const c = buildAppExicon();
  c.ex_aliases.push({
    ...common,
    id: "regional",
    exercise_id: "squat",
    region_id: "the-fe",
    variation_id: null,
    alias: "FE lowering",
  });
  c.ex_aliases.push({
    ...common,
    id: "id-collision",
    exercise_id: "plank",
    region_id: "the-fe",
    variation_id: null,
    alias: "squat",
  });
  c.ex_counting_conventions.push({
    ...common,
    id: "regional-count",
    exercise_id: "squat",
    region_id: "the-fe",
    variation_id: null,
    convention: "2=1",
    cycle_description: "Two lower-and-stand cycles.",
    count_on: null,
  });
  expect(
    resolveExercise(c, "squat", "the-fe").status === "matched" &&
      resolveExercise(c, "squat", "the-fe"),
  ).toEqual(
    expect.objectContaining({
      exercise: expect.objectContaining({ id: "squat" }),
    }),
  );
  const fe = adaptExicon(c, "the-fe"),
    global = adaptExicon(c);
  expect(fe.movements.find((m) => m.id === "squat")?.aliases).toContain(
    "FE lowering",
  );
  expect(global.movements.find((m) => m.id === "squat")?.aliases).not.toContain(
    "FE lowering",
  );
  expect(fe.movements.find((m) => m.id === "squat")?.counting).toContain("2=1");
  expect(fe.ambiguousAliases).toContain("squat");
});
it("uses database requirements for eligibility AND output checks, including Q closure precedence", () => {
  const c = buildAppExicon();
  c.ex_exercise_facilities.push({
    exercise_id: "squat",
    amenity_id: "workout-walls",
    required: true,
  });
  const guide = adaptExicon(c),
    request = input();
  expect(
    contextFor(request, undefined, guide).exercises.some(
      (e) => e.name === "Squat",
    ),
  ).toBe(false);
  const plan = fallbackPlan(request).plan;
  plan.requiredFeatures = [];
  plan.sections[1].blocks[0].exercises[0].name = "Squat";
  plan.sections[1].blocks[0].exercises[0].instructions =
    "Perform controlled squats.";
  expect(() => validatePlan(plan, request, undefined, guide)).toThrow(
    /features/,
  );
  const site = siteContext(request.ao, request.prompt, {
    notes: "",
    overrides: { walls: "available" },
  });
  expect(() => validatePlan(plan, request, site, guide)).not.toThrow();
  const closed = siteContext(request.ao, "The walls are closed today.", {
    notes: "",
    overrides: { walls: "available" },
  });
  expect(() => validatePlan(plan, request, closed, guide)).toThrow(/features/);
});
it("fails closed on unsupported requirements and rejects ambiguous executed names", () => {
  const c = buildAppExicon();
  c.ex_exercise_facilities.push({
    exercise_id: "squat",
    amenity_id: "unknown-required-facility",
    required: true,
  });
  const guide = adaptExicon(c);
  expect(guide.movements.some((m) => m.id === "squat")).toBe(false);
  expect(guide.blockedIds).toContain("squat");
  const request = input(),
    p = fallbackPlan(request).plan;
  p.sections[1].blocks[0].exercises[0].name = "Squat";
  expect(() => validatePlan(p, request, undefined, guide)).toThrow(
    /unsupported facility/,
  );
  const a = buildAppExicon();
  for (const exercise_id of ["squat", "plank"])
    a.ex_aliases.push({
      ...common,
      id: exercise_id + ":shared",
      exercise_id,
      region_id: null,
      variation_id: null,
      alias: "Shared drill",
    });
  p.sections[1].blocks[0].exercises[0].name = "Shared drill";
  p.sections[1].blocks[0].exercises[0].instructions =
    "Perform the shared drill.";
  expect(() => validatePlan(p, request, undefined, adaptExicon(a))).toThrow(
    /ambiguous/,
  );
});
it("checks equipment and running metadata even when directions omit gear/travel words", () => {
  const c = buildAppExicon();
  c.ex_exercises.find((e) => e.id === "squat")!.running = true;
  const request = input(),
    p = fallbackPlan(request).plan;
  p.sections[1].blocks[0].exercises[0].name = "Squat";
  expect(() => validatePlan(p, request, undefined, adaptExicon(c))).toThrow(
    /running/,
  );
  c.ex_exercises.find((e) => e.id === "squat")!.running = false;
  c.ex_exercise_equipment.push({
    exercise_id: "squat",
    equipment_id: "portable-weight",
    required: true,
  });
  expect(() => validatePlan(p, request, undefined, adaptExicon(c))).toThrow(
    /gear/,
  );
});
it("keeps production/preview hard-disabled and exposes only a GET fallback/guide without credentials", async () => {
  for (const context of ["production", "deploy-preview"])
    expect(exiconEnvironment(context, () => "true").enabled).toBe("false");
  const read = vi.fn(async () => buildAppExicon());
  const response = await handleExicon(
    new Request("https://app.invalid/api/exicon?region=the-fe"),
    env,
    read,
  );
  const body = await response.json();
  expect(body.source).toBe("database");
  expect(body.movements).toHaveLength(50);
  expect(JSON.stringify(body)).not.toContain("sb_publishable");
  expect(
    (
      await handleExicon(
        new Request("https://app.invalid/api/exicon", { method: "POST" }),
        env,
        read,
      )
    ).status,
  ).toBe(405);
  expect(
    (
      await handleExicon(
        new Request("https://app.invalid/api/exicon?region=invalid%20region"),
        env,
        read,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await movementGuide(env, undefined, async () => {
        throw Error("outage");
      })
    ).source,
  ).toBe("json");
});
it("passes the same guide through the real handler and provider context without an extra AI call", async () => {
  const catalog = buildAppExicon();
  catalog.ex_exercises.find((e) => e.id === "squat")!.instructions =
    "Verified app-written database squat fixture.";
  const request = input(),
    good = fallbackPlan(request).plan;
  const provider = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          model: "fixture:free",
          choices: [{ message: { content: JSON.stringify(good) } }],
        }),
      ),
  );
  const read = vi.fn(async () => catalog);
  const result = await handlePlanner(
    new Request("https://app.invalid/api/plan-workout", {
      method: "POST",
      headers: {
        Origin: "https://app.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }),
    { exicon: env, OPENROUTER_API_KEY: "fixture" },
    provider,
    async () => null,
    read,
  );
  expect(result.status).toBe(200);
  expect(result.headers.get("X-F3-Exicon-Source")).toBe("database");
  expect(read).toHaveBeenCalledTimes(1);
  expect(provider).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(provider.mock.calls[0][1]?.body)).toContain(
    "Verified app-written database squat fixture",
  );
  const direct = await generatePlan(
    request,
    { OPENROUTER_API_KEY: "fixture" },
    provider,
    undefined,
    undefined,
    adaptExicon(catalog),
  );
  expect(direct.provider).toBe("OpenRouter");
});

it("validates server templates against the same published guide when a provider fails", async () => {
  const request = input();
  const req = () =>
    new Request("https://app.invalid/api/plan-workout", {
      method: "POST",
      headers: {
        Origin: "https://app.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  const failed = vi
    .fn<typeof fetch>()
    .mockRejectedValue(Error("Synthetic provider outage"));
  const normal = buildAppExicon();
  const safe = await handlePlanner(
    req(),
    { exicon: env, OPENROUTER_API_KEY: "fixture" },
    failed,
    async () => null,
    async () => normal,
  );
  expect(safe.status).toBe(200);
  expect((await safe.json()).provider).toBe("Template");
  const restricted = buildAppExicon();
  restricted.ex_exercise_facilities.push({
    exercise_id: "squat",
    amenity_id: "workout-walls",
    required: true,
  });
  const rejected = await handlePlanner(
    req(),
    { exicon: env, OPENROUTER_API_KEY: "fixture" },
    failed,
    async () => null,
    async () => restricted,
  );
  expect(rejected.status).toBe(422);
  const data = await rejected.json();
  expect(data.error).toMatch(/features/);
  expect(data.workout).toBeUndefined();
  const runOnly = buildAppExicon();
  runOnly.ex_exercises.find((e) => e.id === "squat")!.running = true;
  const raw = () =>
    new Request("https://app.invalid/api/plan-workout", {
      method: "POST",
      headers: {
        Origin: "https://app.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        prompt: "Squats, no running and no coupons.",
        running: "From prompt",
        equipment: "From prompt",
      }),
    });
  const implicit = await handlePlanner(
    raw(),
    { exicon: env, OPENROUTER_API_KEY: "fixture" },
    failed,
    async () => null,
    async () => runOnly,
  );
  expect(implicit.status).toBe(422);
  expect((await implicit.json()).error).toMatch(/running/);
});
