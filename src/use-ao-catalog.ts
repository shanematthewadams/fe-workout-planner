import { useEffect, useState } from "react";
import { z } from "zod";
import {
  aoIntelligenceSchema,
  catalogBaseline,
  type AOIntelligence,
} from "./ao-catalog";
import { findAO, siteContext } from "./ao-context";
import { withLocalAO } from "./ao-drafts";
import type { SiteInput } from "./site-contract";
const TTL = 60000;
const cache = new Map<string, { expires: number; value: AOIntelligence }>();
const pending = new Map<string, Promise<AOIntelligence | null>>();
const responseSchema = z.object({
  version: z.literal(1),
  source: z.enum(["database", "json"]),
  catalog: aoIntelligenceSchema.nullable(),
});
export function clearAOCatalogCache() {
  cache.clear();
  pending.clear();
}
export function peekAOCatalog(id: string) {
  const entry = cache.get(id);
  return entry && entry.expires > Date.now() ? entry.value : null;
}
export async function loadAOCatalog(
  id: string,
): Promise<AOIntelligence | null> {
  const saved = peekAOCatalog(id);
  if (saved) return saved;
  if (pending.has(id)) return pending.get(id)!;
  const work = (async () => {
    try {
      const response = await fetch(
        "/api/ao-intelligence?" +
          new URLSearchParams({ ao: id, view: "catalog" }),
        { signal: AbortSignal.timeout(6000), redirect: "error" },
      );
      if (!response.ok) throw Error("AO read unavailable");
      const data = responseSchema.parse(await response.json());
      if (data.source !== "database" || !data.catalog || data.catalog.id !== id)
        throw Error("Saved AO fallback");
      if (cache.size >= 128) cache.delete(cache.keys().next().value!);
      cache.set(id, { expires: Date.now() + TTL, value: data.catalog });
      return data.catalog;
    } catch {
      cache.delete(id);
      return null;
    }
  })();
  pending.set(id, work);
  try {
    return await work;
  } finally {
    pending.delete(id);
  }
}
export function useAOCatalog(name: string, prompt = "") {
  const id = findAO(name, prompt)?.id;
  const [snapshot, setSnapshot] = useState<{
    id?: string;
    catalog: AOIntelligence | null;
    status: "loading" | "live" | "fallback";
  }>(() => ({
    id,
    catalog: id ? peekAOCatalog(id) : null,
    status: id && peekAOCatalog(id) ? "live" : id ? "loading" : "fallback",
  }));
  useEffect(() => {
    if (!id) return;
    let active = true;
    const refresh = async () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      const value = await loadAOCatalog(id);
      if (active)
        setSnapshot({
          id,
          catalog: value,
          status: value ? "live" : "fallback",
        });
    };
    void refresh();
    const timer = setInterval(() => void refresh(), TTL);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [id]);
  const current =
    snapshot.id === id
      ? snapshot
      : {
          id,
          catalog: id ? peekAOCatalog(id) : null,
          status: id ? ("loading" as const) : ("fallback" as const),
        };
  return { catalog: current.catalog, status: current.status, known: !!id };
}
/** Offline templates use the same last-received baseline currently displayed for this AO. */
export function cachedSiteContext(
  ao: string,
  prompt: string,
  site?: SiteInput,
) {
  const id = findAO(ao, prompt)?.id;
  const catalog = id ? peekAOCatalog(id) : null;
  return siteContext(
    ao,
    prompt,
    site,
    catalog ? catalogBaseline(catalog, site?.venueId) : undefined,
  );
}

export function withLiveAO(ao: string, prompt: string, site: SiteInput) {
  const id = findAO(ao, prompt)?.id;
  return withLocalAO(ao, prompt, site, id ? peekAOCatalog(id) : undefined);
}
export function retainLiveQContext(
  ao: string,
  prompt: string,
  site: SiteInput,
) {
  const resolved = withLiveAO(ao, prompt, site),
    context = cachedSiteContext(ao, prompt, resolved);
  return {
    ...resolved,
    overrides: {
      ...resolved.overrides,
      ...Object.fromEntries(
        Object.keys(context.qStatements).map((key) => [
          key,
          context.features[key as keyof typeof context.features],
        ]),
      ),
    },
  };
}
