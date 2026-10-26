import {
  exiconCatalogSchema,
  normalizeExerciseName,
  resolveExercise,
  type ExiconCatalog,
} from "../src/exicon-catalog.ts";
import { movements, type Movement } from "../src/movements.ts";
import type { Feature } from "../src/site-contract.ts";
import {
  catalogEnvironment,
  type CatalogEnvironment,
} from "./ao-intelligence.ts";
const facilities: Record<string, Feature> = {
  "running-track": "track",
  "stairs-stadium-steps": "stairs",
  bleachers: "bleachers",
  "parking-lot": "parkingLot",
  "covered-shelter": "shelter",
  "parking-garage": "shelter",
  "gentle-hill": "hills",
  "steep-hill": "hills",
  "grass-field": "field",
  "artificial-turf": "field",
  "pull-up-bars": "pullupBars",
  benches: "benches",
  "workout-walls": "walls",
  "measured-loop": "runningRoute",
};
const equipment: Record<string, string> = {
  coupon: "Coupon",
  "portable-weight": "Weight",
};
export type MovementGuide = {
  source: "database" | "json";
  movements: Movement[];
  databaseIds: string[];
  blockedIds: string[];
  ambiguousAliases: string[];
  blockedNames: string[];
};
export const bundledGuide = (): MovementGuide => ({
  source: "json",
  movements,
  databaseIds: [],
  blockedIds: [],
  ambiguousAliases: [],
  blockedNames: [],
});
/** Canonical records merge by stable ID only; aliases never select a variation. */
export function adaptExicon(
  catalog: ExiconCatalog,
  regionId?: string,
  selectedVariations: Record<string, string> = {},
): MovementGuide {
  const allowed = new Set(
    catalog.ex_source_licenses
      .filter((l) => l.redistribution_allowed && l.reviewed_at)
      .map((l) => l.source_id),
  );
  const published = (r: { source_id: string; publication_status: string }) =>
    r.publication_status === "published" && allowed.has(r.source_id);
  const accepted = new Map<string, Movement>(),
    blockedIds: string[] = [];
  for (const e of catalog.ex_exercises.filter(published)) {
    // Select this exact canonical ID, independently of a regional alias that looks like an ID.
    const r = resolveExercise(
      catalog,
      e.id,
      regionId,
      selectedVariations[e.id],
    );
    if (r.status !== "matched") {
      blockedIds.push(e.id);
      continue;
    }
    if (
      r.requirements.equipment.some((id) => !equipment[id]) ||
      r.requirements.facilities.some((id) => !facilities[id])
    ) {
      blockedIds.push(e.id);
      continue;
    }
    if (
      movements.some(
        (m) =>
          m.id !== e.id &&
          normalizeExerciseName(m.name) === normalizeExerciseName(e.name),
      )
    ) {
      blockedIds.push(e.id);
      continue;
    }
    const aliases = catalog.ex_aliases
      .filter(
        (a) =>
          published(a) &&
          a.exercise_id === e.id &&
          (!a.region_id || a.region_id === regionId) &&
          a.variation_id === (r.variation?.id ?? null),
      )
      .map((a) => a.alias);
    accepted.set(e.id, {
      id: e.id,
      name: r.variation?.name ?? e.name,
      category: e.movement_category,
      instructions: r.variation?.instructions ?? e.instructions,
      aliases: [
        ...new Set([
          ...aliases,
          ...movements
            .filter((m) => m.id === e.id)
            .flatMap((m) => [m.name, ...m.aliases]),
        ]),
      ],
      counting:
        (r.countingNeedsConfirmation
          ? "Q must choose and demonstrate the complete counting cycle. "
          : "") +
        (r.counting
          .map((c) => `${c.convention}: ${c.cycle_description}`)
          .join(" | ") || "Counting not established."),
      equipment: r.requirements.equipment.map((id) => equipment[id]),
      features: [
        ...new Set(r.requirements.facilities.map((id) => facilities[id])),
      ],
      running: e.running,
      alternative: e.alternative,
    });
  }
  const merged = movements
    .filter((m) => !blockedIds.includes(m.id))
    .map((m) => accepted.get(m.id) ?? m);
  for (const [id, m] of accepted)
    if (!merged.some((existing) => existing.id === id)) merged.push(m);
  const names = new Map<string, Set<string>>();
  for (const m of merged)
    for (const alias of [m.name, ...m.aliases]) {
      const n = normalizeExerciseName(alias);
      const ids = names.get(n) ?? new Set();
      ids.add(m.id);
      names.set(n, ids);
    }
  return {
    source: accepted.size || blockedIds.length ? "database" : "json",
    movements: merged,
    databaseIds: [...accepted.keys()],
    blockedIds,
    blockedNames: catalog.ex_exercises
      .filter((e) => blockedIds.includes(e.id))
      .flatMap((e) => [
        e.name,
        ...catalog.ex_aliases
          .filter(
            (a) =>
              a.exercise_id === e.id &&
              published(a) &&
              (!a.region_id || a.region_id === regionId),
          )
          .map((a) => a.alias),
      ]),
    ambiguousAliases: [...names]
      .filter(([, ids]) => ids.size > 1)
      .map(([name]) => name),
  };
}
/** One atomic RPC/TTL, concurrent callers coalesce. Failed/invalid responses are never cached. */
export function createExiconReader(
  fetcher?: typeof fetch,
  now = Date.now,
  timeoutMs = 2000,
) {
  const cache = new Map<string, { expires: number; value: ExiconCatalog }>(),
    pending = new Map<string, Promise<ExiconCatalog | null>>();
  return async (
    env: CatalogEnvironment = {},
  ): Promise<ExiconCatalog | null> => {
    if (
      env.enabled !== "true" ||
      !env.url ||
      !env.publishableKey?.startsWith("sb_publishable_")
    )
      return null;
    let base: URL;
    try {
      base = new URL(env.url);
      if (base.protocol !== "https:" || base.username || base.password)
        return null;
    } catch {
      return null;
    }
    const key = base.origin + ":" + env.publishableKey;
    const saved = cache.get(key);
    if (saved && saved.expires > now()) return saved.value;
    if (pending.has(key)) return pending.get(key)!;
    const work = (async () => {
      try {
        const response = await (fetcher ?? fetch)(
          new URL("/rest/v1/rpc/fe_exicon_catalog", base),
          {
            headers: { apikey: env.publishableKey! },
            signal: AbortSignal.timeout(timeoutMs),
            redirect: "error",
          },
        );
        if (!response.ok) return null;
        const body = await boundedText(response, 3_000_000);
        const data = exiconCatalogSchema.parse(JSON.parse(body));
        for (const rows of Object.values(data))
          if (Array.isArray(rows) && rows.length > 5000)
            throw Error("Catalog exceeds read bound");
        if (cache.size >= 4) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: now() + 60000, value: data });
        return data;
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
export async function boundedText(response: Response, maximum: number) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Missing response");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) {
      await reader.cancel();
      throw Error("Response exceeds read bound");
    }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return new TextDecoder().decode(all);
}
export const readExicon = createExiconReader();
export async function movementGuide(
  env: CatalogEnvironment = {},
  regionId?: string,
  read = readExicon,
) {
  try {
    const catalog = await read(env);
    return catalog ? adaptExicon(catalog, regionId) : bundledGuide();
  } catch {
    return bundledGuide();
  }
}
export function exiconEnvironment(
  context: string | undefined,
  get: (key: string) => string | undefined,
): CatalogEnvironment {
  const base = catalogEnvironment(context, get);
  return {
    ...base,
    enabled:
      context === "branch-deploy" || context === "dev"
        ? (get("EXICON_CATALOG_ENABLED") ??
          (context === "branch-deploy" ? "true" : "false"))
        : "false",
  };
}
export async function handleExicon(
  request: Request,
  env: CatalogEnvironment = {},
  read = readExicon,
) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "Use GET." }), {
      status: 405,
      headers,
    });
  const region = new URL(request.url).searchParams.get("region") ?? undefined;
  if (region && !/^[a-z0-9-]{1,80}$/.test(region))
    return new Response(JSON.stringify({ error: "Invalid region." }), {
      status: 400,
      headers,
    });
  const guide = await movementGuide(env, region, read);
  return new Response(JSON.stringify({ version: 1, ...guide }), { headers });
}
