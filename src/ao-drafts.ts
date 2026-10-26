import { canonicalVenueId, type AOIntelligence } from "./ao-catalog";
import { findAO, siteContext } from "./ao-context";
import {
  localFeaturesSchema,
  type LocalFeatures,
  type SiteInput,
  type Feature,
} from "./site-contract";
export const TERRAIN_KEY = "fe_ao_terrain_overrides";
export const SITE_Q_KEY = "fe_ao_site_qs";
export function readTerrainDrafts(): Record<string, LocalFeatures> {
  try {
    const raw = JSON.parse(localStorage.getItem(TERRAIN_KEY) ?? "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).flatMap(([id, value]) => {
        const parsed = localFeaturesSchema.safeParse(value);
        return parsed.success ? [[id, parsed.data]] : [];
      }),
    );
  } catch {
    return {};
  }
}
export function withLocalAO(
  ao: string,
  prompt: string,
  site: SiteInput,
  catalog?: AOIntelligence | null,
): SiteInput {
  const profile = findAO(ao, prompt);
  // Resolve afresh: changing AO must never carry another site's draft forward.
  const today = { ...site };
  delete today.localDraft;
  const seasonal = catalog
    ? catalog.location_mode !== "fixed"
    : (profile?.local.venues?.length ?? 0) > 1;
  const venueId = canonicalVenueId(site.venueId);
  const venueKnown = catalog
    ? catalog.location_mode === "site_q_selected" &&
      catalog.ao_venue_assignments.some((v) => v.venue_id === venueId)
    : profile?.local.venues?.some((v) => canonicalVenueId(v.id) === venueId);
  const drafts = readTerrainDrafts();
  const keys = profile
    ? seasonal
      ? venueKnown
        ? [
            `${profile.id}:${venueId}`,
            `${profile.id}:${venueId === "heritage-park-marina" ? "heritage-marina" : venueId}`,
          ]
        : []
      : [profile.id]
    : [];
  const draft = keys.map((key) => drafts[key]).find(Boolean);
  return { ...today, ...(draft ? { localDraft: draft } : {}) };
}

/** Preserve explicit Q facts when a refinement/surprise replaces the original prompt. */
export function retainQContext(
  ao: string,
  prompt: string,
  site: SiteInput,
): SiteInput {
  const resolved = withLocalAO(ao, prompt, site);
  const context = siteContext(ao, prompt, resolved);
  return {
    ...resolved,
    overrides: {
      ...resolved.overrides,
      ...Object.fromEntries(
        Object.keys(context.qStatements).map((feature) => [
          feature,
          context.features[feature as Feature],
        ]),
      ),
    },
  };
}
