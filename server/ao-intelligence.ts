import { z } from "zod";
import { aoProfiles } from "../src/discovery.ts";
import { siteContext, findAO } from "../src/ao-context.ts";
export type CatalogEnvironment = {
  enabled?: string;
  url?: string;
  publishableKey?: string;
};
import {
  aoIntelligenceSchema,
  selectAOContext,
  catalogBaseline,
  type AOIntelligence,
} from "../src/ao-catalog.ts";
export {
  aoIntelligenceSchema,
  selectAOContext,
  catalogBaseline,
  type AOIntelligence,
} from "../src/ao-catalog.ts";
const select =
  "id,name,activity,location_mode,planning_mode,ao_sources(url,captured_at),ao_venue_assignments(venue_id,meeting_point,selection,season_label,lighting_notes,access_notes,terrain_notes,route_notes,local_notes,ao_venues(id,name,address,lighting,access_notes,ao_venue_amenities(amenity_id,availability,verification,evidence,ao_amenity_types(name)))),ao_landmark_links(proximity,ao_landmarks(id,name,venue_id,kind,use_cases,description,restrictions,verification))";
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
          .array(aoIntelligenceSchema)
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
export const readAO = createAOReader();
const reader = readAO;
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
  if (url.searchParams.get("view") === "catalog")
    return send({
      version: 1,
      source: data ? "database" : "json",
      catalog: data,
    });
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

export async function resolvePlannerSite(
  input: {
    ao: string;
    prompt: string;
    site?: import("../src/site-contract.ts").SiteInput;
  },
  env: CatalogEnvironment = {},
  read = readAO,
) {
  const ao = findAO(input.ao, input.prompt);
  const data = ao ? await read(ao.id, env) : null;
  return siteContext(
    input.ao,
    input.prompt,
    input.site,
    data ? catalogBaseline(data, input.site?.venueId) : undefined,
  );
}
/** Public connection defaults for the approved shared catalog, scoped to branch deploys only.
 * Runtime overrides remain available; production app activation requires a separate release. */
export const BRANCH_CATALOG = {
  enabled: "true",
  url: "https://kitqovhdwzkhpxlepvfn.supabase.co",
  publishableKey: "sb_publishable_0JeYeQVmWejiGgAyYXDo9g_F-6r3IDU",
} as const;
export function catalogEnvironment(
  deployContext: string | undefined,
  get: (name: string) => string | undefined,
): CatalogEnvironment {
  const branch = deployContext === "branch-deploy";
  return {
    enabled:
      branch || deployContext === "dev"
        ? (get("AO_CATALOG_ENABLED") ??
          (branch ? BRANCH_CATALOG.enabled : "false"))
        : "false",
    url: get("AO_CATALOG_URL") ?? (branch ? BRANCH_CATALOG.url : undefined),
    publishableKey:
      get("AO_CATALOG_PUBLISHABLE_KEY") ??
      (branch ? BRANCH_CATALOG.publishableKey : undefined),
  };
}
