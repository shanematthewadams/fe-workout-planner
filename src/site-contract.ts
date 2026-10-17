import { z } from "zod";
export const FEATURES = {
  track: "Track",
  stairs: "Steps / stairs",
  bleachers: "Bleachers",
  parkingLot: "Parking lot",
  shelter: "Shelter / covered space",
  hills: "Hills",
  field: "Grass / turf field",
  pullupBars: "Pull-up bars",
  benches: "Benches / raised support",
  walls: "Walls",
  runningRoute: "Measured running route",
} as const;
export const featureSchema = z.enum([
  "track",
  "stairs",
  "bleachers",
  "parkingLot",
  "shelter",
  "hills",
  "field",
  "pullupBars",
  "benches",
  "walls",
  "runningRoute",
]);
export type Feature = z.infer<typeof featureSchema>;
export const availabilitySchema = z.enum([
  "available",
  "unavailable",
  "unknown",
]);
export type Availability = z.infer<typeof availabilitySchema>;
export const SURFACES = {
  unknown: "Unknown",
  asphalt: "Asphalt",
  concrete: "Concrete",
  grass: "Grass",
  turf: "Turf",
  gravel: "Gravel",
  dirt: "Dirt",
  mixed: "Mixed surfaces",
  turf_and_asphalt: "Turf and asphalt",
} as const;
export const LIGHTING = {
  unknown: "Unknown",
  lit: "Lit",
  partially_lit: "Partly lit",
  unlit: "Unlit",
} as const;
export const amenitiesSchema = z
  .object({
    couponsOnSite: z.boolean().nullable().default(null),
    hasCoveredShelter: z.boolean().nullable().default(null),
    hasTrack: z.boolean().nullable().default(null),
    hasBleachers: z.boolean().nullable().default(null),
    hasPullUpBars: z.boolean().nullable().default(null),
    surface: z
      .enum([
        "unknown",
        "asphalt",
        "concrete",
        "grass",
        "turf",
        "gravel",
        "dirt",
        "mixed",
        "turf_and_asphalt",
      ])
      .default("unknown"),
    lighting: z
      .enum(["unknown", "lit", "partially_lit", "unlit"])
      .default("unknown"),
  })
  .strict();
export const amenitiesPatchSchema = amenitiesSchema.partial().strict();
export type Amenities = z.infer<typeof amenitiesSchema>;
export const AMENITY_FEATURES = {
  hasCoveredShelter: "shelter",
  hasTrack: "track",
  hasBleachers: "bleachers",
  hasPullUpBars: "pullupBars",
} as const;
export const localFeaturesSchema = z.record(
  featureSchema,
  z
    .object({
      state: availabilitySchema,
      detail: z.string().max(400).optional(),
    })
    .strict(),
);
export type LocalFeatures = z.infer<typeof localFeaturesSchema>;
export const siteInputSchema = z
  .object({
    // Unpublished device edits are Q context, never regional facts.
    localDraft: localFeaturesSchema.optional(),
    overrides: z.record(featureSchema, availabilitySchema).default({}),
    notes: z.string().max(800).default(""),
    amenities: amenitiesPatchSchema.optional(),
  })
  .strict();
export type SiteInput = z.infer<typeof siteInputSchema>;
export const startTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z.object({
  startTime: startTimeSchema,
  requiredFeatures: z.array(featureSchema).max(11).default([]),
  siteSummary: z.string().max(1600).optional(),
});
