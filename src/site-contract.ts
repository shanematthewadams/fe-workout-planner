import { z } from "zod";
export const FEATURES = {
  track: "Track",
  stairs: "Steps / stairs",
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
export const siteInputSchema = z
  .object({
    overrides: z.record(featureSchema, availabilitySchema).default({}),
    notes: z.string().max(800).default(""),
  })
  .strict();
export type SiteInput = z.infer<typeof siteInputSchema>;
export const startTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const scheduleSchema = z.object({
  startTime: startTimeSchema,
  requiredFeatures: z.array(featureSchema).max(10).default([]),
  siteSummary: z.string().max(1600).optional(),
});
