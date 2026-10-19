import { z } from "zod";
import {
  fetchNationDirectory,
  directoryCandidates,
  NationRegionError,
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
    if (problem instanceof NationRegionError) {
      const normalize = (name: string) =>
        name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const localNames = new Set(local.map((ao) => normalize(ao.name)));
      const configured = problem.organizations.find(
        (org) => org.orgId === regionId,
      );
      return Response.json(
        {
          status: "unavailable",
          reason: "nation-region",
          regionId,
          organizationCount: problem.organizations.length,
          aoCount: problem.organizations.filter((org) => org.orgType === "ao")
            .length,
          configuredOrganization: configured
            ? {
                id: configured.orgId,
                name: configured.name,
                type: configured.orgType,
              }
            : null,
          localNameMatches: problem.organizations
            .filter((org) => org.name && localNames.has(normalize(org.name)))
            .slice(0, 100)
            .map((org) => ({
              id: org.orgId,
              name: org.name,
              type: org.orgType,
              regions: org.hierarchy
                .filter(([, , type]) => type === "region")
                .map(([id, name]) => ({ id, name })),
            })),
        },
        { status: 502 },
      );
    }
    const schema = problem instanceof z.ZodError;
    const message = problem instanceof Error ? problem.message : "";
    const upstreamStatus =
      Number(message.match(/read failed \((\d{3})\)/)?.[1]) || undefined;
    const authorization =
      problem instanceof Error &&
      /read failed \((401|403)\)/.test(problem.message);
    return Response.json(
      {
        status: "unavailable",
        ...(upstreamStatus ? { upstreamStatus } : {}),
        ...(problem instanceof Error ? { failureType: problem.name } : {}),
        ...(message.startsWith("No regional AOs")
          ? { detail: "no-regional-aos" }
          : {}),
        ...(message.startsWith("Official location identity")
          ? { detail: "location-identity" }
          : {}),
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
