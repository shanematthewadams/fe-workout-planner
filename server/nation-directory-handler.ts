import { z } from "zod";
import {
  fetchNationDirectory,
  directoryCandidates,
} from "../scripts/nation-directory";
import local from "../data/ao-official.json";

type NationEnvironment = {
  token?: string;
  regionId?: string;
  deployContext?: string;
};
/** Staging-only, fixed-region read. Never accepts a token, URL or region from the caller. */
export async function handleNationDirectory(
  request: Request,
  env: NationEnvironment,
  fetcher: typeof fetch = fetch,
) {
  if (env.deployContext !== "branch-deploy")
    return new Response(null, { status: 404 });
  if (request.method !== "GET")
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const token = env.token?.trim();
  const regionId = Number(env.regionId);
  if (
    !token ||
    token.includes("*") ||
    !Number.isSafeInteger(regionId) ||
    regionId <= 0
  ) {
    return Response.json(
      { status: "unavailable", reason: "server-configuration" },
      { status: 503 },
    );
  }
  try {
    const deadline = AbortSignal.timeout(40000);
    const boundedFetch: typeof fetch = (input, init) =>
      fetcher(input, {
        ...init,
        signal: AbortSignal.any([
          deadline,
          ...(init?.signal ? [init.signal] : []),
        ]),
      });
    const directory = await fetchNationDirectory({
      token,
      regionId,
      fetcher: boundedFetch,
    });
    return Response.json({
      ...directory,
      candidates: directoryCandidates(directory, local),
    });
  } catch (problem) {
    const schema = problem instanceof z.ZodError;
    const authorization =
      problem instanceof Error &&
      /read failed \((401|403)\)/.test(problem.message);
    return Response.json(
      {
        status: "unavailable",
        reason: authorization
          ? "nation-authorization"
          : schema
            ? "nation-schema"
            : "nation-directory",
        ...(schema
          ? {
              issues: problem.issues
                .slice(0, 8)
                .map(({ code, path }) => ({ code, path })),
            }
          : {}),
      },
      { status: 502 },
    );
  }
}
