import type { Config, Context } from "@netlify/functions";
import {
  handleAOIntelligence,
  catalogEnvironment,
} from "../../server/ao-intelligence.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default (request: Request, context: Context) =>
  handleAOIntelligence(
    request,
    catalogEnvironment(context.deploy.context, (name) => Netlify.env.get(name)),
  );

export const config: Config = {
  path: "/api/ao-intelligence",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 60,
  },
};
