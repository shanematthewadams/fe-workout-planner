import { buildCatalog } from "../../scripts/ao-intelligence.ts";
import { aoIntelligenceSchema } from "../../server/ao-intelligence.ts";
const { catalog } = buildCatalog();
export function catalogAO(id: string) {
  const ao = catalog.ao_sites.find((a) => a.id === id);
  if (!ao) throw Error("Unknown fixture AO");
  return aoIntelligenceSchema.parse({
    ...ao,
    ao_sources: catalog.ao_sources.find((s) => s.id === ao.source_id),
    ao_venue_assignments: catalog.ao_venue_assignments
      .filter((a) => a.ao_id === id)
      .map((a) => ({
        ...a,
        ao_venues: {
          ...catalog.ao_venues.find((v) => v.id === a.venue_id),
          ao_venue_amenities: catalog.ao_venue_amenities.filter(
            (f) => f.venue_id === a.venue_id,
          ),
        },
      })),
    ao_landmark_links: catalog.ao_landmark_links
      .filter((l) => l.ao_id === id)
      .map((l) => ({
        ...l,
        ao_landmarks: catalog.ao_landmarks.find((m) => m.id === l.landmark_id),
      })),
  });
}
