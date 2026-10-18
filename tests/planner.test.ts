import { describe, it, expect, vi } from "vitest";
import { contextFor, F3_BRIEF } from "../server/planner-context";
import {
  generatePlan,
  validatePlan,
  resolveRequest,
} from "../server/planner-service";
import { handlePlanner } from "../netlify/functions/plan-workout.mts";
import {
  plannerRequestSchema,
  GOLD_RUSH_EXAMPLE,
  plannerResponseSchema,
} from "../src/planner-contract";
import { parseBackup } from "../src/model";
import { isVerifiedFreeGeminiKey } from "../server/provider-policy";
import { planFixture } from "./fixtures/plan";
import { fallbackPlan } from "../src/fallback";
const input = () => plannerRequestSchema.parse({ prompt: GOLD_RUSH_EXAMPLE });
it("tries the next free provider when the first returns a timing violation", async () => {
  const request = plannerRequestSchema.parse({
    prompt: "Bodyweight workout",
    equipment: "None",
    strictSchedule: true,
  });
  const good = fallbackPlan(request).plan,
    bad = structuredClone(good);
  bad.sections[1].blocks[0].minutes = 50;
  const f = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(bad) }] } }],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "fixture:free",
          choices: [{ message: { content: JSON.stringify(good) } }],
        }),
      ),
    );
  const response = await generatePlan(
    request,
    {
      GEMINI_API_KEY: "fixture",
      GEMINI_FREE_TIER_CONFIRMED: "true",
      OPENROUTER_API_KEY: "fixture",
    },
    f,
  );
  expect(response.provider).toBe("OpenRouter");
  expect(f).toHaveBeenCalledTimes(2);
});
const fetchOK = () =>
  vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        model: "test-model:free",
        choices: [{ message: { content: JSON.stringify(planFixture) } }],
      }),
    ),
  );
describe("F3 context and private draft boundary", () => {
  it("supplies terms, explicit counting, verified Gold Rush facts and approved workout-only references", () => {
    const ctx = contextFor(input());
    expect(ctx.ao?.name).toBe("Gold Rush");
    expect(ctx.ao?.local.features?.track?.state).toBe("available");
    expect(ctx.site.features.stairs).toBe("unknown");
    expect(F3_BRIEF).toContain("2=1");
    expect(F3_BRIEF).toContain("Q = workout leader");
    expect(F3_BRIEF).toContain("No tools");
    expect(ctx.references).toHaveLength(3);
    expect(
      ctx.references.every((r) => r.id.startsWith("f3nation:event:")),
    ).toBe(true);
    expect(JSON.stringify(ctx)).not.toContain("rawNotes");
  });
  it("labels generated work personal, keeps trusted provenance and survives existing backup format", async () => {
    const response = await generatePlan(
      input(),
      { OPENROUTER_API_KEY: "secret-not-for-browser" },
      fetchOK(),
    );
    expect(plannerResponseSchema.safeParse(response).success).toBe(true);
    expect(response.workout.kind).toBe("personal");
    expect(response.workout.provenance.status).toBe("personal");
    expect(response.workout.provenance.durationBasis).toBe("inferred");
    expect(response.workout.provenance.ao).toBe("Gold Rush");
    expect(
      response.workout.provenance.generation?.referenceSourceIds,
    ).toHaveLength(3);
    expect(JSON.stringify(response)).not.toContain("secret-not-for-browser");
    expect(
      parseBackup(
        JSON.stringify({
          format: "fe-workout-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          workouts: [response.workout],
          favorites: [],
        }),
      ).workouts[0],
    ).toEqual(response.workout);
  });
  it("sends the current draft and change request without unrelated local data", async () => {
    const f = fetchOK();
    await generatePlan(
      {
        ...input(),
        prompt: "Less running, keep the gold theme.",
        current: planFixture,
      },
      { OPENROUTER_API_KEY: "test-key" },
      f,
    );
    const body = JSON.parse(String(f.mock.calls[0][1]?.body));
    const task = JSON.parse(body.messages[1].content);
    expect(task.request.current).toEqual(planFixture);
    expect(task.request.prompt).toContain("Less running");
    expect(body.messages[0].content).toContain("preserving its theme");
  });
});
describe("free-only routing and output checks", () => {
  it("honors natural language duration, no running, no coupon and no Mary requests", () => {
    const r = resolveRequest({
      ...input(),
      prompt: "Make it 30 minutes, no running, without coupons and no Mary.",
    });
    expect(r).toMatchObject({
      minutes: 30,
      running: "None",
      equipment: "None",
      mary: false,
    });
  });
  it("only enables the independently verified Free-tier Gemini key", () => {
    expect(isVerifiedFreeGeminiKey("test-Ldg")).toBe(true);
    expect(isVerifiedFreeGeminiKey("different-key")).toBe(false);
    expect(isVerifiedFreeGeminiKey(undefined)).toBe(false);
  });
  it("sets the dedicated free router and zero price ceiling, never calling unconfirmed Gemini", async () => {
    const f = fetchOK();
    await generatePlan(
      input(),
      { OPENROUTER_API_KEY: "test", GEMINI_API_KEY: "not-confirmed" },
      f,
    );
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    const body = JSON.parse(String(f.mock.calls[0][1]?.body));
    expect(body.model).toBe("openrouter/free");
    expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
  });
  it("honors explicit free-provider selection without bypassing tier checks", async () => {
    const f = fetchOK();
    await generatePlan(
      { ...input(), provider: "openrouter" },
      {
        OPENROUTER_API_KEY: "test",
        GEMINI_API_KEY: "test",
        GEMINI_FREE_TIER_CONFIRMED: "true",
      },
      f,
    );
    expect(f.mock.calls[0][0]).toContain("openrouter.ai");
    f.mockClear();
    await expect(
      generatePlan(
        { ...input(), provider: "gemini" },
        { GEMINI_API_KEY: "test" },
        f,
      ),
    ).rejects.toThrow("not configured");
    expect(f).not.toHaveBeenCalled();
  });
  it("uses Gemini only with a confirmed free-tier project and falls back only to free OpenRouter", async () => {
    const f = fetchOK();
    f.mockReset();
    f.mockResolvedValueOnce(
      new Response("", { status: 429 }),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "test:free",
          choices: [{ message: { content: JSON.stringify(planFixture) } }],
        }),
      ),
    );
    const response = await generatePlan(
      input(),
      {
        OPENROUTER_API_KEY: "test",
        GEMINI_API_KEY: "test",
        GEMINI_FREE_TIER_CONFIRMED: "true",
      },
      f,
    );
    expect(String(f.mock.calls[0][0])).toContain("gemini-3.5-flash-lite");
    expect(f).toHaveBeenCalledTimes(2);
    expect(response.provider).toBe("OpenRouter");
  });
  it("reports free quota, malformed output and upstream failures without provider bodies or paid retries", async () => {
    for (const [status, message] of [
      [429, "limit"],
      [500, "unavailable"],
    ] as const) {
      const f = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("SECRET UPSTREAM BODY", { status }));
      await expect(
        generatePlan(input(), { OPENROUTER_API_KEY: "test" }, f),
      ).rejects.toThrow(message);
      expect(f).toHaveBeenCalledTimes(1);
    }
    await expect(
      generatePlan(
        input(),
        { OPENROUTER_API_KEY: "test" },
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "not json" } }],
            }),
          ),
        ),
      ),
    ).rejects.toThrow("incomplete draft");
  });
  it("rejects missing/duplicate/reordered sections, wrong total timing and ignored preferences", () => {
    const wrong = structuredClone(planFixture);
    wrong.sections[1].blocks[0].minutes = 99;
    expect(() => validatePlan(wrong, input())).toThrow();
    for (const sections of [
      planFixture.sections.slice(1),
      [
        planFixture.sections[1],
        planFixture.sections[0],
        planFixture.sections[2],
      ],
      [
        planFixture.sections[0],
        planFixture.sections[1],
        planFixture.sections[1],
      ],
    ])
      expect(() =>
        validatePlan({ ...planFixture, sections }, input()),
      ).toThrow();
    expect(() =>
      validatePlan(planFixture, { ...input(), running: "None" }),
    ).toThrow("running");
    expect(() =>
      validatePlan({ ...planFixture, equipment: [] }, input()),
    ).toThrow("coupons");
    expect(() =>
      validatePlan(planFixture, { ...input(), mary: false }),
    ).toThrow();
  });
});
describe("request endpoint", () => {
  const request = (body: string, options: RequestInit = {}) =>
    new Request(
      "https://develop--fe-workout-planner.netlify.app/api/plan-workout",
      {
        method: "POST",
        headers: {
          origin: "https://develop--fe-workout-planner.netlify.app",
          "Content-Type": "application/json",
        },
        body,
        ...options,
      },
    );
  it("rejects cross-site, malformed and oversized requests before provider calls", async () => {
    const f = fetchOK();
    expect(
      (
        await handlePlanner(
          request("{}", {
            headers: {
              origin: "https://evil.example",
              "content-type": "application/json",
            },
          }),
          {},
          f,
        )
      ).status,
    ).toBe(403);
    expect((await handlePlanner(request("{bad"), {}, f)).status).toBe(400);
    expect(
      (await handlePlanner(request(" ".repeat(48001)), {}, f)).status,
    ).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });
  it("returns validated personal JSON with no-store and no credentials", async () => {
    const response = await handlePlanner(
      request(JSON.stringify(input())),
      { OPENROUTER_API_KEY: "keep-secret" },
      fetchOK(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).not.toContain("keep-secret");
    expect(plannerResponseSchema.safeParse(JSON.parse(text)).success).toBe(
      true,
    );
  });
});
