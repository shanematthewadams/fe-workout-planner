import { execFileSync } from "node:child_process";
import type { Catalog } from "../../scripts/ao-intelligence.ts";
import { aoIntelligenceSchema } from "../../src/ao-catalog";
// Build the locked source fixture in Node so jsdom's HTTP import.meta.url cannot
// turn the importer filesystem root into a web URL.
const catalog: Catalog = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      "import {buildCatalog} from './scripts/ao-intelligence.ts';process.stdout.write(JSON.stringify(buildCatalog().catalog));",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 4000000,
      timeout: 10000,
    },
  ),
);
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
          ao_venue_amenities: catalog.ao_venue_amenities
            .filter((f) => f.venue_id === a.venue_id)
            .map((f) => ({
              ...f,
              ao_amenity_types: {
                name: catalog.ao_amenity_types.find(
                  (t) => t.id === f.amenity_id,
                )!.name,
              },
            })),
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
