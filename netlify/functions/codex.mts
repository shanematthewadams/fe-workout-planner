import type { Config, Context } from "@netlify/functions";
import { exiconEnvironment } from "../../server/exicon-intelligence.ts";
import { handleCodexReference } from "../../server/codex-reference.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default (request: Request, context: Context) =>
  handleCodexReference(
    request,
    exiconEnvironment(context.deploy.context, (name) => Netlify.env.get(name)),
  );
export const config: Config = {
  path: "/api/codex",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: ["domain", "ip"],
    windowSize: 60,
    windowLimit: 60,
  },
};
