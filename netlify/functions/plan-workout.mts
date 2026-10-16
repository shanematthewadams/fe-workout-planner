import type { Config } from "@netlify/functions";
import { fallbackPlan } from "../../src/fallback.ts";
import { plannerRequestSchema } from "../../src/planner-contract.ts";
import { ZodError } from "zod";
import { isVerifiedFreeGeminiKey } from "../../server/provider-policy.ts";
import { generatePlan, PlannerError } from "../../server/planner-service.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export async function handlePlanner(
  req: Request,
  env: Parameters<typeof generatePlan>[1],
  fetcher: typeof fetch = fetch,
) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
  const send = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method !== "POST") return send({ error: "Use POST." }, 405);
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return send({ error: "Request must come from this planner." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return send({ error: "Use JSON." }, 415);
  try {
    const reader = req.body?.getReader();
    if (!reader) return send({ error: "Missing request." }, 400);
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 48000) {
        await reader.cancel();
        return send({ error: "Request is too large." }, 413);
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    const input = plannerRequestSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    let result;
    try {
      result = await generatePlan(input, env, fetcher, req.signal);
    } catch (error) {
      if (!input.strictSchedule || input.current || req.signal.aborted)
        throw error;
      result = fallbackPlan(input);
    }
    return send(result);
  } catch (error) {
    if (error instanceof PlannerError)
      return send({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return send(
        {
          error:
            "Check the request or try a simpler draft. Your saved workouts have not changed.",
        },
        400,
      );
    return send(
      { error: "Free AI is unavailable. Your previous draft is safe." },
      503,
    );
  }
}
export default async (req: Request) => {
  return handlePlanner(req, {
    OPENROUTER_API_KEY: Netlify.env.get("OPENROUTER_API_KEY"),
    GEMINI_API_KEY: Netlify.env.get("GEMINI_API_KEY"),
    GEMINI_FREE_TIER_CONFIRMED: isVerifiedFreeGeminiKey(
      Netlify.env.get("GEMINI_API_KEY"),
    )
      ? "true"
      : "false",
  });
};
export const config: Config = {
  path: "/api/plan-workout",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 5,
  },
};
