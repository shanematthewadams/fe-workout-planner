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
  id,
  name: z.string(),
  orgType: z.literal("ao"),
  parentId: id,
  defaultLocationId: id.nullable(),
  isActive: z.boolean(),
});
const pageSchema = z.object({
  orgs: z.array(orgSchema),
  total: z.number().int().min(0).max(10000),
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
  const organizations: z.infer<typeof orgSchema>[] = [];
  let total: number | undefined;
  for (let pageIndex = 0; ; pageIndex++) {
    const query = new URLSearchParams({
      orgTypes: "ao",
      parentOrgIds: String(regionId),
      statuses: "active",
      pageIndex: String(pageIndex),
      pageSize: "100",
    });
    const page = pageSchema.parse(await get(`org?${query}`));
    if (total !== undefined && page.total !== total)
      throw Error(
        "Nation directory changed during pagination; retry the complete import.",
      );
    total = page.total;
    if (page.orgs.some((org) => org.parentId !== regionId || !org.isActive))
      throw Error("Official AO region or activity mismatch; import stopped.");
    organizations.push(...page.orgs);
    if (
      new Set(organizations.map((org) => org.id)).size !== organizations.length
    )
      throw Error("Duplicate official AO identity; import stopped.");
    if (organizations.length === total) break;
    if (!page.orgs.length || organizations.length > total || pageIndex >= 99)
      throw Error("Incomplete Nation directory pagination; import stopped.");
  }
  if (!organizations.length)
    throw Error(
      "No regional AOs returned; verify the official region identity.",
    );
  const locationIds = [
    ...new Set(
      organizations.flatMap((org) =>
        org.defaultLocationId ? [org.defaultLocationId] : [],
      ),
    ),
  ];
  const locations: z.infer<typeof locationSchema>[] = [];
  for (let index = 0; index < locationIds.length; index += 4) {
    const batch = await Promise.all(
      locationIds.slice(index, index + 4).map(async (locationId) => {
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
        return location;
      }),
    );
    locations.push(...batch);
  }
  const orgs = organizations.map(
    ({ id: orgId, name, parentId, defaultLocationId, orgType }) => ({
      orgId,
      name,
      parentId,
      defaultLocationId,
      orgType,
    }),
  );
  return {
    sourceUrl: "https://api.f3nation.com/docs",
    checkedAt: new Date().toISOString(),
    regionId,
    locationBasis: "default" as const,
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
      locationIds: org.defaultLocationId ? [org.defaultLocationId] : [],
      locationBasis: directory.locationBasis,
    };
  });
}
