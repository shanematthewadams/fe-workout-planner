import { z } from "zod";
const id = z.number().int().positive();
const locationSchema = z.object({
  id,
  locationName: z.string(),
  regionId: id.nullable(),
  isActive: z.boolean(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  addressStreet: z.string().nullable(),
  addressCity: z.string().nullable(),
  addressState: z.string().nullable(),
});
const orgSchema = z.object({
  orgId: id,
  name: z.string().nullable(),
  orgType: z.string(),
  hierarchy: z.array(z.tuple([id, z.string().nullable(), z.string()])),
  activeLocations: z.array(
    z.object({
      locationId: id,
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    }),
  ),
});
/** Uses the official OpenAPI contract retrieved 2026-10-19. Strip contact/leadership data. */
export async function fetchNationDirectory({
  token,
  regionId,
  fetcher = fetch,
}: {
  token: string;
  regionId: number;
  fetcher?: typeof fetch;
}) {
  if (!token.trim() || !Number.isSafeInteger(regionId) || regionId <= 0)
    throw Error("F3_NATION_TOKEN and F3_REGION_ID are required server-side.");
  const get = async (path: string) => {
    const response = await fetcher(`https://api.f3nation.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        client: "fe-workout-planner",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(
        `Nation directory read failed (${response.status}); existing records retained.`,
      );
    return response.json();
  };
  const orgs = z
    .object({ orgs: z.array(orgSchema.nullable()) })
    .parse(await get("org-chart"))
    .orgs.filter(
      (org): org is z.infer<typeof orgSchema> =>
        !!org &&
        org.orgType === "ao" &&
        org.hierarchy.some(
          ([ancestor, , type]) => ancestor === regionId && type === "region",
        ),
    );
  if (!orgs.length)
    throw Error(
      "No regional AOs returned; retain the existing snapshot and verify token scope and region ID.",
    );
  if (new Set(orgs.map((org) => org.orgId)).size !== orgs.length)
    throw Error("Duplicate official AO identity; import stopped.");
  const locationIds = [
    ...new Set(
      orgs.flatMap((org) =>
        org.activeLocations.map((location) => location.locationId),
      ),
    ),
  ];
  const locations: z.infer<typeof locationSchema>[] = [];
  for (const locationId of locationIds) {
    const location = z
      .object({ location: locationSchema.nullable() })
      .parse(await get(`location/id/${locationId}`)).location;
    if (
      !location ||
      location.id !== locationId ||
      location.regionId !== regionId ||
      !location.isActive
    )
      throw Error(
        "Official location identity, activity or region mismatch; import stopped.",
      );
    locations.push(location);
  }
  return {
    sourceUrl: "https://api.f3nation.com/docs",
    checkedAt: new Date().toISOString(),
    regionId,
    orgs,
    locations,
  };
}
/** Exact names produce review candidates only. Never create or rename local AO identities. */
export function directoryCandidates(
  directory: Awaited<ReturnType<typeof fetchNationDirectory>>,
  local: { id: string; name: string }[],
) {
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return directory.orgs.map((org) => {
    const matches = local.filter(
      (ao) => normalize(ao.name) === normalize(org.name ?? ""),
    );
    return {
      nationOrgId: org.orgId,
      name: org.name,
      localId: matches.length === 1 ? matches[0].id : null,
      status: "needs-review",
      locationIds: org.activeLocations.map((location) => location.locationId),
    };
  });
}
