import type { Config, Context } from "@netlify/functions";
import {
  exiconEnvironment,
  handleExicon,
} from "../../server/exicon-intelligence.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default (request: Request, context: Context) =>
  handleExicon(
    request,
    exiconEnvironment(context.deploy.context, (name) => Netlify.env.get(name)),
  );
export const config: Config = {
  path: "/api/exicon",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 60,
  },
};
