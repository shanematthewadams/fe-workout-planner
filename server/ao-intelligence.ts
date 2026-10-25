import { z } from "zod";
import { aoProfiles } from "../src/discovery.ts";
import { siteContext } from "../src/ao-context.ts";
const fact = z.object({
  amenity_id: z.string(),
  availability: z.enum(["present", "absent", "unknown", "restricted"]),
  verification: z.enum(["reported", "unverified", "reviewed"]),
  evidence: z.string(),
});
const landmark = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  restrictions: z.string().nullable(),
  verification: z.enum(["reported", "unverified", "reviewed"]),
});
const schema = z.object({
  id: z.string(),
  name: z.string(),
  activity: z.enum(["bootcamp", "run", "ruck"]),
  location_mode: z.enum(["fixed", "site_q_selected", "rotating"]),
  planning_mode: z.string(),
  ao_venue_assignments: z.array(
    z.object({
      venue_id: z.string(),
      meeting_point: z.string(),
      selection: z.enum(["default", "site_q_required"]),
      season_label: z.string(),
      lighting_notes: z.string().nullable(),
      access_notes: z.string().nullable(),
      terrain_notes: z.string().nullable(),
      route_notes: z.string().nullable(),
      local_notes: z.string().nullable(),
      ao_venues: z.object({
        id: z.string(),
        name: z.string(),
        address: z.string().nullable(),
        lighting: z.string().nullable(),
        access_notes: z.string().nullable(),
        ao_venue_amenities: z.array(fact),
      }),
    }),
  ),
  ao_landmark_links: z.array(
    z.object({
      proximity: z.enum(["on_site", "nearby", "unknown"]),
      ao_landmarks: landmark,
    }),
  ),
});
export type AOIntelligence = z.infer<typeof schema>;
export type CatalogEnvironment = {
  enabled?: string;
  url?: string;
  publishableKey?: string;
};
const select =
  "id,name,activity,location_mode,planning_mode,ao_venue_assignments(venue_id,meeting_point,selection,season_label,lighting_notes,access_notes,terrain_notes,route_notes,local_notes,ao_venues(id,name,address,lighting,access_notes,ao_venue_amenities(amenity_id,availability,verification,evidence))),ao_landmark_links(proximity,ao_landmarks(id,name,description,restrictions,verification))";
/** Per-reader bounded TTL cache; cache successful reads only and coalesce concurrent requests. */
export function createAOReader(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; value: AOIntelligence }>();
  const pending = new Map<string, Promise<AOIntelligence | null>>();
  return async (
    id: string,
    env: CatalogEnvironment,
  ): Promise<AOIntelligence | null> => {
    if (env.enabled !== "true" || !env.url || !env.publishableKey) return null;
    // Public credentials only. A legacy anon JWT is deliberately not accepted by this new path.
    if (!env.publishableKey.startsWith("sb_publishable_")) return null;
    let base: URL;
    try {
      base = new URL(env.url);
      if (base.protocol !== "https:" || base.username || base.password)
        return null;
    } catch {
      return null;
    }
    const key = base.origin + ":" + env.publishableKey + ":" + id;
    const saved = cache.get(key);
    if (saved && saved.expires > now()) return saved.value;
    if (pending.has(key)) return pending.get(key)!;
    const work = (async () => {
      try {
        const url = new URL("/rest/v1/ao_sites", base);
        url.search = new URLSearchParams({
          id: "eq." + id,
          select,
          limit: "1",
        }).toString();
        const response = await fetcher(url, {
          headers: { apikey: env.publishableKey! },
          signal: AbortSignal.timeout(2500),
          redirect: "error",
        });
        if (!response.ok) return null;
        const parsed = z
          .array(schema)
          .max(1)
          .parse(await response.json());
        if (!parsed.length || parsed[0].id !== id) return null;
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: now() + 60000, value: parsed[0] });
        return parsed[0];
      } catch {
        return null;
      }
    })();
    pending.set(key, work);
    try {
      return await work;
    } finally {
      pending.delete(key);
    }
  };
}
/** Selecting one venue is explicit; date labels never choose a venue. Restricted is not available. */
export function selectAOContext(ao: AOIntelligence, venueId?: string) {
  const active =
    ao.location_mode === "rotating"
      ? undefined
      : ao.location_mode === "site_q_selected"
        ? ao.ao_venue_assignments.find((a) => a.venue_id === venueId)
        : ao.ao_venue_assignments.find((a) => a.selection === "default");
  return {
    aoId: ao.id,
    name: ao.name,
    activity: ao.activity,
    planningMode: ao.planning_mode,
    locationMode: ao.location_mode,
    venueRequired: !active,
    meetingPoint: active?.meeting_point ?? null,
    venue: active?.ao_venues ?? null,
    assignment: active
      ? {
          seasonLabel: active.season_label,
          lighting: active.lighting_notes,
          access: active.access_notes,
          terrain: active.terrain_notes,
          routes: active.route_notes,
          notes: active.local_notes,
        }
      : null,
    // Nearby destinations are returned separately; never promoted into venue facilities.
    landmarks: ao.ao_landmark_links.filter(
      (l) => l.ao_landmarks.verification !== "unverified",
    ),
    usableAmenities:
      active?.ao_venues.ao_venue_amenities.filter(
        (a) => a.availability === "present" && a.verification !== "unverified",
      ) ?? [],
  };
}
const reader = createAOReader();
export async function handleAOIntelligence(
  request: Request,
  env: CatalogEnvironment,
  read = reader,
) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const send = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  if (request.method !== "GET") return send({ error: "Use GET." }, 405);
  const url = new URL(request.url),
    id = url.searchParams.get("ao");
  const ao = aoProfiles.find((a) => a.id === id);
  if (!ao) return send({ error: "Unknown AO." }, 404);
  const data = await read(ao.id, env);
  if (data)
    return send({
      source: "database",
      context: selectAOContext(
        data,
        url.searchParams.get("venue") ?? undefined,
      ),
    });
  return send({
    source: "json",
    context: siteContext(ao.name, "", {
      venueId:
        url.searchParams.get("venue") === "heritage-park-marina"
          ? "heritage-marina"
          : (url.searchParams.get("venue") ?? undefined),
      notes: "",
      overrides: {},
    }),
    migrationFallback: true,
  });
}
