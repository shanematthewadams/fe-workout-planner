import { z } from "zod";
import official from "../data/ao-official.json" with { type: "json" };
import { localFeaturesSchema, amenitiesPatchSchema } from "./site-contract.ts";
const text = z.string().trim().min(1).max(600);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Use a real review date",
  );
export const landmarkSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: text,
    status: z.enum(["reported", "confirmed"]),
    use: z.enum(["workout", "gathering", "nearby"]),
    restrictions: z.string().max(600).default(""),
  })
  .strict();
export const venueSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    name: z.string().min(1).max(160),
    season: text,
    access: text,
    features: localFeaturesSchema.default({}),
  })
  .strict();
export const aoUpdateSchema = z
  .object({
    format: z.literal("fe-ao-update"),
    version: z.literal(1),
    aoId: z
      .string()
      .refine((id) => official.some((ao) => ao.id === id), "Choose a known AO"),
    source: text,
    sourceUrl: z
      .string()
      .url()
      .max(600)
      .refine((url) => /^https:\/\//.test(url)),
    checkedAt: date,
    features: localFeaturesSchema.default({}),
    amenities: amenitiesPatchSchema.optional(),
    landmarks: z.array(landmarkSchema).max(30).default([]),
    venues: z.array(venueSchema).max(10).default([]),
    accessNotes: z.string().max(1200).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.venues.map((v) => v.id)).size !== value.venues.length)
      ctx.addIssue({ code: "custom", message: "Venue IDs must be unique" });
    if (
      value.venues.length > 1 &&
      (Object.keys(value.features).length ||
        Object.keys(value.amenities ?? {}).length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Put seasonal amenities on a venue, not on the AO",
      });
  });
export type AOUpdate = z.infer<typeof aoUpdateSchema>;
export function parseAOUpdate(input: string) {
  if (new TextEncoder().encode(input).byteLength > 80000)
    throw Error("AO update exceeds 80 KB.");
  return aoUpdateSchema.parse(JSON.parse(input));
}
/** Repository maintainers run this after reviewing the proposal. The app cannot publish. */
export function reviewedAO(update: AOUpdate, reviewer: string) {
  if (!reviewer.trim() || reviewer.length > 100)
    throw Error("Name the regional reviewer.");
  return {
    features: update.features,
    ...(update.amenities ? { amenities: update.amenities } : {}),
    checkedAt: update.checkedAt,
    sourceUrl: update.sourceUrl,
    reviewBasis: `${update.source}. Reviewed by ${reviewer.trim()}; site reports do not establish current access.`,
    landmarks: update.landmarks,
    venues: update.venues,
    accessNotes: update.accessNotes,
  };
}
