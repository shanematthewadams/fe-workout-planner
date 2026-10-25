import { it, expect, vi } from "vitest";
import { catalogAO } from "./fixtures/ao-catalog";
import {
  catalogBaseline,
  resolvePlannerSite,
  createAOReader,
  catalogEnvironment,
} from "../server/ao-intelligence";
import { siteContext } from "../src/ao-context";
import {
  resolveRequest,
  generatePlan,
  validatePlan,
} from "../server/planner-service";
import { contextFor } from "../server/planner-context";
import { handlePlanner } from "../server/planner-handler";
import { fallbackPlan } from "../src/fallback";
import { parseBackup } from "../src/model";
const env = {
  enabled: "true",
  url: "https://isolated.supabase.co",
  publishableKey: "sb_publishable_fixture",
};
const request = () =>
  resolveRequest({
    ao: "Gold Rush",
    prompt: "Bodyweight circuit",
    equipment: "None",
    running: "None",
    strictSchedule: true,
  });
const reader = async (id: string) => catalogAO(id);
it("uses database absence in prompt eligibility, validation and saved summaries instead of bundled facts", async () => {
  const input = request(),
    data = catalogAO("fe-ao-gold-rush");
  const track = data.ao_venue_assignments[0].ao_venues.ao_venue_amenities.find(
    (f) => f.amenity_id === "running-track",
  )!;
  track.availability = "absent";
  track.verification = "reviewed";
  const site = await resolvePlannerSite(input, env, async () => data);
  expect(site.features.track).toBe("unavailable");
  expect(site.dataSource).toBe("database");
  expect(siteContext(input.ao).features.track).toBe("available");
  const ctx = contextFor(input, site);
  expect(ctx.site).toBe(site);
  expect(
    ctx.exercises.every((e) => !e.requiredFeatures.includes("track")),
  ).toBe(true);
  const plan = fallbackPlan(input, site).plan;
  plan.requiredFeatures = ["track"];
  expect(() => validatePlan(plan, input, site)).toThrow(
    "unavailable site features",
  );
  const copy = fallbackPlan(input, site).workout;
  expect(copy.schedule?.siteSummary).toMatch(
    /Meeting point: By basketball goals/,
  );
  expect(copy.schedule?.siteSummary).toMatch(/Unavailable: Track/);
  expect(
    parseBackup(
      JSON.stringify({
        format: "fe-workout-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        favorites: [],
        workouts: [copy],
      }),
    ),
  ).toBeDefined();
});
it("preserves temporary Q precedence and text closures over database facts", async () => {
  const input = resolveRequest({
    ao: "Gold Rush",
    prompt: "The stairs are closed today.",
    site: {
      localDraft: { stairs: { state: "available" } },
      amenities: { hasTrack: true },
      overrides: { stairs: "available" },
    },
  });
  const site = await resolvePlannerSite(input, env, reader);
  expect(site.features.stairs).toBe("unavailable");
  expect(site.features.track).toBe("available");
  expect(site.localDraft.stairs?.state).toBe("available");
  const same = siteContext(
    input.ao,
    input.prompt,
    input.site,
    catalogBaseline(catalogAO("fe-ao-gold-rush")),
  );
  expect(same).toEqual(site);
});
it("keeps incomplete aggregate amenities unknown and restricted facilities unusable", () => {
  const data = catalogAO("fe-ao-pretty-bird");
  const facts = data.ao_venue_assignments[0].ao_venues.ao_venue_amenities;
  facts.find((f) => f.amenity_id === "grass-field")!.availability = "unknown";
  facts.find((f) => f.amenity_id === "running-track")!.availability =
    "restricted";
  const baseline = catalogBaseline(data);
  expect(baseline.features?.field?.state).toBe("unknown");
  expect(baseline.features?.track?.state).toBe("unavailable");
  expect(baseline.features?.shelter?.state).toBe("unknown");
  expect(
    baseline.landmarks.some((l) => l.name === "Garmin parking garage"),
  ).toBe(false);
});
it("retains shared venue identity and separate flag locations", async () => {
  const a = await resolvePlannerSite(
    resolveRequest({ ao: "Baywatch", prompt: "Bodyweight circuit" }),
    env,
    reader,
  );
  const b = await resolvePlannerSite(
    resolveRequest({ ao: "Airfield", prompt: "Bodyweight circuit" }),
    env,
    reader,
  );
  expect(a.venueId).toBe(b.venueId);
  expect(a.flagLocation).toMatch(/Southwest/);
  expect(b.flagLocation).toMatch(/Northernmost/);
});
it("requires seasonal selection and accepts the existing UI venue ID without leaking another venue landmarks", async () => {
  const input = resolveRequest({
    ao: "South Park",
    prompt: "Bodyweight circuit",
    site: { localDraft: { track: { state: "available" } } },
  });
  const no = await resolvePlannerSite(input, env, reader);
  expect(no.venueRequired).toBe(true);
  expect(no.available).toEqual([]);
  expect(no.landmarks).toEqual([]);
  input.site!.venueId = "heritage-marina";
  const marina = await resolvePlannerSite(input, env, reader);
  expect(marina.venue).toBe("Heritage Park Marina");
  expect(marina.landmarks.some((l) => /Brougham/.test(l.name))).toBe(false);
  input.site!.venueId = "brougham-elementary";
  const school = await resolvePlannerSite(input, env, reader);
  expect(school.venue).toBe("Brougham Elementary");
  expect(school.features.shelter).toBe("unknown");
});
it("retains route conventions and event-specific mobile location requirements without overriding Q choices", async () => {
  const input = resolveRequest({
    ao: "Overdraft",
    prompt: "Route and COT",
    planning: {
      activity: "Ruck",
      route: "Q chooses route",
      pace: "Conversational",
    },
  });
  const site = await resolvePlannerSite(input, env, reader);
  const ctx = contextFor(input, site);
  expect(site.conventions?.activity).toBe("run");
  expect(ctx.planning.activity).toBe("Ruck");
  expect(site.features.track).toBe("unknown");
  const mobile = await resolvePlannerSite(
    resolveRequest({ ao: "Vagabonds", prompt: "Route and COT" }),
    env,
    reader,
  );
  expect(mobile.venue).toBeUndefined();
  expect(mobile.venueRequired).toBe(true);
  expect(mobile.available).toEqual([]);
});
it("coalesces reads and falls back identically to JSON on schema/network failure without a provider call", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(JSON.stringify([catalogAO("fe-ao-gold-rush")])),
    );
  const read = createAOReader(fetcher);
  await Promise.all([
    resolvePlannerSite(request(), env, read),
    resolvePlannerSite(request(), env, read),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const fail = createAOReader(async () => {
    throw Error("Offline");
  });
  expect(await resolvePlannerSite(request(), env, fail)).toEqual(
    siteContext("Gold Rush", request().prompt),
  );
});
it("uses one resolved database context for AI input, returned plan validation and persisted plan", async () => {
  const input = request();
  const site = await resolvePlannerSite(input, env, reader);
  const plan = fallbackPlan(input, site).plan;
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(plan) } }],
      }),
    ),
  );
  const result = await generatePlan(
    input,
    { OPENROUTER_API_KEY: "fixture" },
    fetcher,
    undefined,
    site,
  );
  expect(result.workout.schedule?.siteSummary).toContain("Meeting point:");
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  const message = JSON.parse(body.messages[1].content);
  expect(message.verifiedContext.site.dataSource).toBe("database");
  expect(message.verifiedContext.site.features).toEqual(site.features);
});
it("API template recovery reuses the same database read and refuses client-supplied trusted context", async () => {
  const input = request();
  const read = vi.fn(reader);
  const provider = vi
    .fn<typeof fetch>()
    .mockRejectedValue(Error("Unavailable"));
  const req = (value: unknown) =>
    new Request("https://staging.test/api/plan-workout", {
      method: "POST",
      headers: {
        origin: "https://staging.test",
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });
  const response = await handlePlanner(
    req(input),
    { catalog: env },
    provider,
    read,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("x-f3-ao-source")).toBe("database");
  expect(read).toHaveBeenCalledTimes(1);
  const value = await response.json();
  expect(value.provider).toBe("Template");
  expect(value.workout.schedule.siteSummary).toContain("Meeting point:");
  expect(provider).not.toHaveBeenCalled();
  const malicious = await handlePlanner(
    req({ ...input, preparedSite: { features: { track: "available" } } }),
    { catalog: env },
    provider,
    read,
  );
  expect(malicious.status).toBe(400);
});
it("keeps production app disabled while allowing the explicitly approved shared database on staging", () => {
  const defaults = catalogEnvironment("branch-deploy", () => undefined);
  expect(defaults.enabled).toBe("true");
  expect(defaults.url).toBe("https://kitqovhdwzkhpxlepvfn.supabase.co");
  expect(defaults.publishableKey).toMatch(/^sb_publishable_/);
  expect(catalogEnvironment("dev", () => undefined).enabled).toBe("false");
  expect(catalogEnvironment("deploy-preview", () => undefined).enabled).toBe(
    "false",
  );
  expect(
    catalogEnvironment("branch-deploy", (n) =>
      n === "AO_CATALOG_ENABLED" ? "false" : undefined,
    ).enabled,
  ).toBe("false");
  const settings: Record<string, string> = {
    AO_CATALOG_ENABLED: "true",
    AO_CATALOG_URL: env.url,
    AO_CATALOG_PUBLISHABLE_KEY: env.publishableKey,
  };
  expect(catalogEnvironment("production", (n) => settings[n]).enabled).toBe(
    "false",
  );
  settings.AO_CATALOG_URL = "https://kitqovhdwzkhpxlepvfn.supabase.co";
  expect(catalogEnvironment("branch-deploy", (n) => settings[n]).enabled).toBe(
    "true",
  );
  settings.AO_CATALOG_URL = env.url;
  expect(catalogEnvironment("branch-deploy", (n) => settings[n]).enabled).toBe(
    "true",
  );
});
