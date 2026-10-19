import {
  plannerRequestSchema,
  plannerResponseSchema,
  resolveRequest,
  type PlannerRequest,
} from "../src/planner-contract";
import { validatePlan } from "./planner-service";
export const evaluationCases = [
  {
    id: "coupon-partners",
    request: {
      prompt:
        "A digging-for-gold coupon workout for 13 PAX in partners. No running. No use of the closed track.",
      ao: "Gold Rush",
      equipment: "Coupon",
      running: "None",
      strictSchedule: true,
      site: {
        notes: "The track is closed today.",
        overrides: { track: "unavailable" },
      },
      planning: { pax: 13, grouping: "Partners" },
    },
  },
  {
    id: "unknown-seasonal-venue",
    request: {
      prompt:
        "A bodyweight Q with no running. Use no fixed facilities unless confirmed today. Do not assume summer amenities.",
      ao: "South Park",
      equipment: "None",
      running: "None",
      strictSchedule: true,
      site: {
        venueId: "brougham-elementary",
        notes: "No venue amenities are confirmed.",
        overrides: {},
      },
    },
  },
  {
    id: "individual-core-rain",
    request: {
      prompt:
        "An individual core-focused Q for one person, no partner requirements, no running or equipment. The grassy area is closed.",
      ao: "Heartland",
      equipment: "None",
      running: "None",
      strictSchedule: true,
      site: {
        notes: "The grass is muddy and closed.",
        overrides: { field: "unavailable" },
      },
      planning: {
        pax: 1,
        grouping: "Individual",
        focus: "Core",
        weather: ["Rain"],
      },
    },
  },
] as const;
export function assessEvaluation(value: unknown, request: PlannerRequest) {
  const parsed = plannerResponseSchema.parse(value);
  if (parsed.provider === "Template")
    return {
      outcome: "template" as const,
      reason: parsed.fallbackReason ?? "Provider returned a template",
      provider: parsed.provider,
    };
  validatePlan(parsed.plan, resolveRequest(request));
  return {
    outcome: "ai" as const,
    provider: parsed.provider,
    model: parsed.model,
    workout: parsed.workout,
    plan: parsed.plan,
  };
}
export async function runEvaluation(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
) {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "https:" ||
    base.hostname !== "studio-ux-streamline--fe-workout-planner.netlify.app"
  )
    throw Error("Live evaluation is restricted to the approved staging host.");
  const results: Record<string, unknown>[] = [];
  let original: ReturnType<typeof plannerResponseSchema.parse> | undefined;
  for (const item of [
    ...evaluationCases,
    {
      id: "targeted-refinement",
      request: {
        prompt: "Keep the same theme but remove all equipment and running.",
        ao: "Gold Rush",
        equipment: "None",
        running: "None",
        strictSchedule: true,
      },
    },
  ]) {
    if (item.id === "targeted-refinement" && !original) {
      results.push({
        id: item.id,
        outcome: "skipped",
        reason: "No validated AI draft to refine",
      });
      continue;
    }
    const request = plannerRequestSchema.parse({
      ...item.request,
      ...(item.id === "targeted-refinement" ? { current: original!.plan } : {}),
    });
    const began = Date.now();
    try {
      const response = await fetcher(new URL("/api/plan-workout", base), {
        method: "POST",
        headers: { Origin: base.origin, "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(55000),
      });
      if ([401, 403].includes(response.status)) {
        results.push({
          id: item.id,
          outcome: "auth-blocked",
          status: response.status,
        });
        break;
      }
      if (response.status === 429) {
        results.push({ id: item.id, outcome: "rate-limited", status: 429 });
        break;
      }
      if (!response.ok) {
        results.push({
          id: item.id,
          outcome: "request-failed",
          status: response.status,
        });
        continue;
      }
      const value: unknown = await response.json();
      const result = assessEvaluation(value, request);
      if (item.id === "coupon-partners" && result.outcome === "ai")
        original = plannerResponseSchema.parse(value);
      results.push({ id: item.id, ...result, elapsedMs: Date.now() - began });
    } catch (error) {
      results.push({
        id: item.id,
        outcome: "failed",
        reason: error instanceof Error ? error.message : "Unknown error",
        elapsedMs: Date.now() - began,
      });
    }
  }
  return {
    checkedAt: new Date().toISOString(),
    host: base.hostname,
    paidProviders: false,
    results,
    passed:
      results.length === 4 && results.every((value) => value.outcome === "ai"),
  };
}
