import { z } from "zod";
import type { SiteBaseline } from "./ao-context";
const fact = z.object({
  amenity_id: z.string(),
  availability: z.enum(["present", "absent", "unknown", "restricted"]),
  verification: z.enum(["reported", "unverified", "reviewed"]),
  evidence: z.string(),
  ao_amenity_types: z.object({ name: z.string() }).optional(),
});
const landmark = z.object({
  id: z.string(),
  name: z.string(),
  venue_id: z.string().nullable(),
  kind: z.string(),
  use_cases: z.string(),
  description: z.string(),
  restrictions: z.string().nullable(),
  verification: z.enum(["reported", "unverified", "reviewed"]),
});
export const aoIntelligenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  activity: z.enum(["bootcamp", "run", "ruck"]),
  location_mode: z.enum(["fixed", "site_q_selected", "rotating"]),
  planning_mode: z.string(),
  ao_sources: z.object({ url: z.string().url(), captured_at: z.string() }),
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
export type AOIntelligence = z.infer<typeof aoIntelligenceSchema>;

export const canonicalVenueId = (id: string | undefined) =>
  id === "heritage-marina" ? "heritage-park-marina" : id;
/** Selecting one venue is explicit; date labels never choose a venue. Restricted is not available. */
export function selectAOContext(ao: AOIntelligence, venueId?: string) {
  venueId = canonicalVenueId(venueId);
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
      (l) =>
        l.ao_landmarks.verification !== "unverified" &&
        (ao.location_mode === "fixed" ||
          (active && l.ao_landmarks.venue_id === active.venue_id)),
    ),
    usableAmenities:
      active?.ao_venues.ao_venue_amenities.filter(
        (a) => a.availability === "present" && a.verification !== "unverified",
      ) ?? [],
  };
}

const featureAmenities = {
  track: ["running-track"],
  stairs: ["stairs-stadium-steps"],
  bleachers: ["bleachers"],
  parkingLot: ["parking-lot"],
  shelter: ["covered-shelter", "parking-garage"],
  hills: ["gentle-hill", "steep-hill"],
  field: ["grass-field", "artificial-turf"],
  pullupBars: ["pull-up-bars"],
  benches: ["benches"],
  walls: ["workout-walls"],
  runningRoute: ["measured-loop"],
} as const;
/** A missing/restricted facility is never promoted; aggregate absence requires every alternative absent. */
export function catalogBaseline(
  ao: AOIntelligence,
  venueId?: string,
): SiteBaseline {
  const current = selectAOContext(ao, venueId);
  const facts = current.venue?.ao_venue_amenities ?? [];
  const features = Object.fromEntries(
    Object.entries(featureAmenities).map(([feature, ids]) => {
      const values = ids.map(
        (id) =>
          facts.find(
            (f) => f.amenity_id === id && f.verification !== "unverified",
          )?.availability,
      );
      const state = values.includes("present")
        ? "available"
        : values.every((v) => v === "absent" || v === "restricted")
          ? "unavailable"
          : "unknown";
      return [
        feature,
        {
          state,
          detail: ids
            .map((id) => {
              const fact = facts.find((f) => f.amenity_id === id);
              const label =
                fact?.ao_amenity_types?.name ?? id.replaceAll("-", " ");
              const state =
                !fact || fact.verification === "unverified"
                  ? "not confirmed"
                  : fact.availability === "present"
                    ? "reported present"
                    : fact.availability === "absent"
                      ? "reported absent"
                      : fact.availability === "restricted"
                        ? "restricted — confirm access"
                        : "not confirmed";
              return `${label}: ${state}`;
            })
            .join("; "),
        },
      ];
    }),
  ) as NonNullable<SiteBaseline["features"]>;
  const coupons = facts.find(
    (f) =>
      f.amenity_id === "coupons-on-site" && f.verification !== "unverified",
  )?.availability;
  return {
    features,
    amenities: {
      couponsOnSite:
        coupons === "present" ? true : coupons === "absent" ? false : null,
    },
    venue: current.venue?.name,
    venueId: current.venue?.id,
    venueRequired: current.venueRequired,
    flagLocation: current.meetingPoint ?? undefined,
    accessNotes: [
      current.venue?.access_notes,
      current.assignment?.access,
      current.assignment?.lighting,
      current.assignment?.routes,
      facts.some(
        (f) =>
          f.availability === "restricted" && f.verification !== "unverified",
      )
        ? "Restricted facilities: " +
          facts
            .filter(
              (f) =>
                f.availability === "restricted" &&
                f.verification !== "unverified",
            )
            .map((f) => f.amenity_id.replaceAll("-", " "))
            .join(", ") +
          ". Confirm access before use."
        : null,
      ao.location_mode === "rotating"
        ? "Confirm the meeting point and route for this event."
        : null,
      current.venueRequired && ao.location_mode === "site_q_selected"
        ? "Confirm the active venue with the Site Q; no calendar cutover is assumed."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    // Nearby and gathering-only destinations cannot establish on-site workout permissions.
    landmarks: current.landmarks
      .filter(
        (l) =>
          l.proximity === "on_site" &&
          l.ao_landmarks.venue_id === current.venue?.id &&
          !/indoor|gathering|coffeeteria/i.test(
            l.ao_landmarks.kind + " " + l.ao_landmarks.use_cases,
          ),
      )
      .map((l) => ({
        name: l.ao_landmarks.name,
        description: l.ao_landmarks.description,
        status: "reported" as const,
        use: "workout" as const,
        restrictions: l.ao_landmarks.restrictions ?? "",
      })),
    sourceUrl: ao.ao_sources.url,
    capturedAt: ao.ao_sources.captured_at,
    conventions: { activity: ao.activity, planningMode: ao.planning_mode },
  };
}
