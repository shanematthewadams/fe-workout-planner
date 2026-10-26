import { useState, type ReactNode } from "react";
import { useAOCatalog } from "./use-ao-catalog";
import { catalogBaseline, type AOIntelligence } from "./ao-catalog";
import { siteContext } from "./ao-context";
import { withLocalAO } from "./ao-drafts";
import type { LocalFeatures } from "./site-contract";
import type { aoProfiles } from "./discovery";
export function AOLiveCard({
  profile,
  draft,
  children,
}: {
  profile: (typeof aoProfiles)[number];
  draft?: LocalFeatures;
  children: (value: {
    context: ReturnType<typeof siteContext>;
    catalog: AOIntelligence | null;
    status: "loading" | "live" | "fallback";
    venueId: string;
    onVenue: (id: string) => void;
  }) => ReactNode;
}) {
  const live = useAOCatalog(profile.name);
  const [venueId, onVenue] = useState("");
  const baseline = live.catalog
    ? catalogBaseline(live.catalog, venueId)
    : undefined;
  const seasonal = live.catalog
    ? live.catalog.location_mode === "site_q_selected"
    : (profile.local.venues?.length ?? 0) > 1;
  const site = seasonal
    ? withLocalAO(
        profile.name,
        "",
        {
          venueId: venueId || undefined,
          overrides: {},
          notes: "",
        },
        live.catalog,
      )
    : {
        venueId: venueId || undefined,
        overrides: {},
        notes: "",
        localDraft: draft,
      };
  const context = siteContext(profile.name, "", site, baseline);
  return children({
    context,
    catalog: live.catalog,
    status: live.status,
    venueId,
    onVenue,
  });
}
