import { findAO } from "./ao-context";
import {
  localFeaturesSchema,
  type LocalFeatures,
  type SiteInput,
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
): SiteInput {
  const profile = findAO(ao, prompt);
  // Resolve afresh: changing AO must never carry another site's draft forward.
  const today = { ...site };
  delete today.localDraft;
  const draft = profile && readTerrainDrafts()[profile.id];
  return { ...today, ...(draft ? { localDraft: draft } : {}) };
}
