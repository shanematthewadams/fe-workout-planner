import type { Config } from "@netlify/functions";
import { handlePlanner } from "../../server/planner-handler.ts";
import { isVerifiedFreeGeminiKey } from "../../server/provider-policy.ts";
export { handlePlanner } from "../../server/planner-handler.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
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
