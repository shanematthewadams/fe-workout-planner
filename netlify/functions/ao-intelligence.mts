import type { Config, Context } from "@netlify/functions";
import { handleAOIntelligence } from "../../server/ao-intelligence.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default (request: Request, context: Context) =>
  handleAOIntelligence(request, {
    // Separate isolated catalog configuration. Production stays disabled throughout migration.
    enabled:
      context.deploy.context === "production"
        ? "false"
        : Netlify.env.get("AO_CATALOG_ENABLED"),
    url: Netlify.env.get("AO_CATALOG_URL"),
    publishableKey: Netlify.env.get("AO_CATALOG_PUBLISHABLE_KEY"),
  });
export const config: Config = {
  path: "/api/ao-intelligence",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 60,
  },
};
