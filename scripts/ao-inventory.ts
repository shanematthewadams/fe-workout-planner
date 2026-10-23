import { z } from "zod";
import official from "../data/ao-official.json" with { type: "json" };
import current from "../data/ao-local.json" with { type: "json" };
import roster from "../data/ao-site-qs.json" with { type: "json" };
import {
  aoUpdateSchema,
  landmarkSchema,
  venueSchema,
} from "../src/ao-review.ts";
import {
  amenitiesPatchSchema,
  localFeaturesSchema,
} from "../src/site-contract.ts";

// Reports remain proposals. This module has no persistence or publication path.
const date = aoUpdateSchema.innerType().shape.checkedAt;
const source = z
  .object({
    source: z.string().trim().min(1).max(600),
    sourceUrl: z
      .string()
      .url()
      .max(600)
      .refine((v) => v.startsWith("https://")),
    checkedAt: date,
  })
  .strict();
const fields: Record<string, z.ZodTypeAny> = {
  name: z.string().trim().min(1).max(160),
  siteQs: z.array(z.string().trim().min(1).max(80)).max(10),
  accessNotes: z.string().max(1200),
  landmarks: z
    .array(
      landmarkSchema.extend({
        distance: z
          .object({
            value: z.number().positive().max(100000),
            unit: z.enum(["meters", "miles"]),
            certainty: z.enum(["approximate", "confirmed", "unknown"]),
          })
          .strict()
          .optional(),
      }),
    )
    .max(30),
  venues: z.array(venueSchema).max(10),
  season: z.string().max(600),
  access: z.string().max(600),
  lightningShelter: z.enum(["confirmed", "unavailable", "unknown"]),
  indoorCoffeeteria: z.enum(["available", "unavailable", "unknown"]),
  indoorWorkoutPermission: z.enum(["confirmed", "denied", "unknown"]),
};
for (const [key, schema] of Object.entries(amenitiesPatchSchema.shape))
  fields[`amenities.${key}`] = schema;
for (const key of [
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
])
  fields[`features.${key}`] = localFeaturesSchema.valueSchema;
const reportSchema = source
  .extend({
    aoId: z.string().min(1).max(100),
    venueId: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
    facts: z
      .record(z.string().max(100), z.unknown())
      .refine((v) => Object.keys(v).length <= 80),
  })
  .strict();
export const inventorySchema = z
  .object({
    format: z.literal("fe-ao-inventory"),
    version: z.literal(1),
    reports: z.array(reportSchema).max(300),
  })
  .strict();
const signature = (value: unknown): string => {
  if (Array.isArray(value)) return JSON.stringify(value.map(signature).sort());
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, signature(v)]),
    );
  return JSON.stringify(value) ?? "undefined";
};
function read(object: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" && Object.hasOwn(value, key)
          ? (value as Record<string, unknown>)[key]
          : undefined,
      object,
    );
}
export function compareInventory(input: unknown) {
  const inventory = inventorySchema.parse(input);
  const groups = new Map<string, typeof inventory.reports>();
  for (const report of inventory.reports) {
    const key = `${report.aoId}/${report.venueId ?? "AO"}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  return {
    format: "fe-ao-inventory-review",
    version: 1,
    requiresReview: true,
    warnings: [
      "Omitted fields and AOs are not removals. An explicit empty list proposes removal; unknown never means unavailable.",
      "All changes require regional review. Nearby facilities, seasonal venues, weather cover, lightning shelter, indoor coffee access and workout permission are separate facts.",
      "Distance certainty is retained, never inferred. No report is applied by this tool.",
    ],
    groups: [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, reports]) => {
        const { aoId, venueId } = reports[0];
        const ao = official.find((item) => item.id === aoId);
        const local = (current as Record<string, unknown>)[aoId];
        const venues = read(local, "venues") as { id: string }[] | undefined;
        const venue = venueId
          ? venues?.find((item) => item.id === venueId)
          : undefined;
        const baseline = venueId
          ? venue
          : {
              ...(local as object),
              name: ao?.name,
              siteQs: (roster.siteQs as Record<string, { names: string[] }>)[
                aoId
              ]?.names,
            };
        const ambiguous = !ao || (!!venueId && !venue);
        const names = [
          ...new Set(reports.flatMap((r) => Object.keys(r.facts))),
        ].sort();
        return {
          group,
          aoId,
          venueId,
          baselineSource: {
            local: {
              sourceUrl: read(local, "sourceUrl"),
              checkedAt: read(local, "checkedAt"),
            },
            roster: {
              sourceUrl: roster.sourceUrl,
              checkedAt: roster.checkedAt,
            },
            official: ao && {
              sourceUrl: ao.sourceUrl,
              checkedAt: ao.checkedAt,
            },
          },
          facts: names.map((field) => {
            const claims = reports
              .filter((r) => Object.hasOwn(r.facts, field))
              .map((r) => ({
                value: r.facts[field],
                source: r.source,
                sourceUrl: r.sourceUrl,
                checkedAt: r.checkedAt,
              }));
            const before = read(baseline, field);
            const value = claims[0].value;
            const unsupported =
              !Object.hasOwn(fields, field) ||
              claims.some(
                (c) =>
                  c.value !== null && !fields[field].safeParse(c.value).success,
              );
            const unknown =
              value === null ||
              value === "unknown" ||
              read(value, "state") === "unknown";
            const status = unsupported
              ? "unsupported"
              : ambiguous ||
                  (!venueId &&
                    (venues?.length ?? 0) > 1 &&
                    /^(features\.|amenities\.|landmarks$|lightningShelter$|indoor)/.test(
                      field,
                    ))
                ? "ambiguous"
                : new Set(claims.map((c) => signature(c.value))).size > 1
                  ? "conflicting"
                  : signature(before) === signature(value)
                    ? "unchanged"
                    : unknown
                      ? "unknown"
                      : Array.isArray(value) && !value.length
                        ? "removed"
                        : before === undefined
                          ? "added"
                          : "changed";
            return { field, status, before: before ?? null, claims };
          }),
        };
      }),
  };
}
