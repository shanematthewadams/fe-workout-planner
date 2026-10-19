import type { Config, Context } from "@netlify/functions";
import { handleNationDirectory } from "../../server/nation-directory-handler.ts";
declare const Netlify: { env: { get(name: string): string | undefined } };
export default (request: Request, context: Context) =>
  handleNationDirectory(request, {
    token: Netlify.env.get("F3_NATION_TOKEN"),
    regionId: Netlify.env.get("F3_REGION_ID"),
    deployContext: context.deploy.context,
  });
export const config: Config = {
  path: "/api/nation-directory",
  rateLimit: {
    action: "rate_limit",
    aggregateBy: "domain",
    windowSize: 60,
    windowLimit: 3,
  },
};
