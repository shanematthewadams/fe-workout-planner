import { exiconEnvironment } from "../../server/exicon-intelligence.ts";
import type { Config, Context } from "@netlify/functions";
import { catalogEnvironment } from "../../server/ao-intelligence.ts";
import { handlePlanner } from "../../server/planner-handler.ts";
import { isVerifiedFreeGeminiKey } from "../../server/provider-policy.ts";
export { handlePlanner } from "../../server/planner-handler.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default async (req: Request, context: Context) => {
  return handlePlanner(req, {
    exicon: exiconEnvironment(context.deploy.context, (name) =>
      Netlify.env.get(name),
    ),
    catalog: catalogEnvironment(context.deploy.context, (name) =>
      Netlify.env.get(name),
    ),
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
