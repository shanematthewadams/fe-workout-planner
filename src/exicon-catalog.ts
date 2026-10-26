import { z } from "zod";
export const normalizeExerciseName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const id = z.string().trim().min(1);
const content = z.string().trim().min(1);
const source = z.object({
  source_id: id,
  publication_status: z.enum(["draft", "reviewed", "published"]),
  revision: z.number().int().positive(),
  protected: z.boolean(),
});
const exercise = source
  .extend({
    id,
    name: content,
    instructions: content,
    movement_category: content,
    running: z.boolean(),
    alternative: content,
  })
  .strict();
const variation = source
  .extend({
    id,
    exercise_id: id,
    region_id: id.nullable(),
    name: content,
    instructions: content,
    equipment_mode: z.enum(["inherit", "replace"]),
    facility_mode: z.enum(["inherit", "replace"]),
  })
  .strict();
const alias = source
  .extend({
    id,
    exercise_id: id,
    variation_id: id.nullable(),
    region_id: id.nullable(),
    alias: content,
  })
  .strict()
  .refine(
    (row) => !!normalizeExerciseName(row.alias),
    "Alias must contain letters or digits",
  );
const counting = source
  .extend({
    id,
    exercise_id: id,
    variation_id: id.nullable(),
    region_id: id.nullable(),
    convention: z.enum([
      "1=1",
      "2=1",
      "per-side",
      "cadence",
      "time",
      "distance",
      "not-applicable",
      "unknown",
    ]),
    cycle_description: content,
    count_on: z.number().int().min(1).max(4).nullable(),
  })
  .strict()
  .refine(
    (row) => (row.convention === "cadence") === (row.count_on !== null),
    "Cadence alone requires a completion count",
  );
export const exiconCatalogSchema = z
  .object({
    version: z.literal(1),
    ao_sources: z.array(
      z
        .object({
          id,
          kind: z.literal("review"),
          url: z.string().url(),
          captured_at: z.string().datetime(),
          description: content,
        })
        .strict(),
    ),
    ex_source_licenses: z.array(
      z
        .object({
          source_id: id,
          license_name: content,
          permission_url: z.string().url().startsWith("https://"),
          reviewed_at: z.string().datetime().nullable(),
          redistribution_allowed: z.boolean(),
        })
        .strict()
        .refine(
          (row) => !row.redistribution_allowed || row.reviewed_at !== null,
          "Permission must be reviewed",
        ),
    ),
    ex_exercises: z.array(exercise),
    ex_variations: z.array(variation),
    ex_aliases: z.array(alias),
    ex_counting_conventions: z.array(counting),
    ex_equipment_types: z.array(z.object({ id, name: content }).strict()),
    ex_exercise_equipment: z.array(
      z
        .object({ exercise_id: id, equipment_id: id, required: z.boolean() })
        .strict(),
    ),
    ex_exercise_facilities: z.array(
      z
        .object({ exercise_id: id, amenity_id: id, required: z.boolean() })
        .strict(),
    ),
    ex_variation_equipment: z.array(
      z
        .object({ variation_id: id, equipment_id: id, required: z.boolean() })
        .strict(),
    ),
    ex_variation_facilities: z.array(
      z
        .object({ variation_id: id, amenity_id: id, required: z.boolean() })
        .strict(),
    ),
    ex_formats: z.array(
      source.extend({ id, name: content, instructions: content }).strict(),
    ),
    ex_format_parameters: z.array(
      z
        .object({
          format_id: id,
          parameter_key: id,
          value_type: z.enum(["integer", "number", "text", "boolean"]),
          required: z.boolean(),
          minimum: z.number().finite().nullable(),
          maximum: z.number().finite().nullable(),
        })
        .strict()
        .refine(
          (row) =>
            (row.minimum === null ||
              row.maximum === null ||
              row.minimum <= row.maximum) &&
            (["integer", "number"].includes(row.value_type) ||
              (row.minimum === null && row.maximum === null)) &&
            (row.value_type !== "integer" ||
              [row.minimum, row.maximum].every(
                (v) => v === null || Number.isInteger(v),
              )),
          "Invalid parameter bounds",
        ),
    ),
  })
  .strict();
export type ExiconCatalog = z.infer<typeof exiconCatalogSchema>;
export type CanonicalExercise = ExiconCatalog["ex_exercises"][number];
type Variation = ExiconCatalog["ex_variations"][number];
type Candidate = { exercise: CanonicalExercise; variation: Variation | null };
/** Exact identity/alias lookup, never substring guessing or implied counting. No network/AI. */
export function resolveExercise(
  catalog: ExiconCatalog,
  query: string,
  regionId?: string,
  variationId?: string,
) {
  const allowed = new Set(
    catalog.ex_source_licenses
      .filter((l) => l.redistribution_allowed && l.reviewed_at)
      .map((l) => l.source_id),
  );
  const published = (r: { source_id: string; publication_status: string }) =>
    r.publication_status === "published" && allowed.has(r.source_id);
  const exercises = catalog.ex_exercises.filter(published);
  const variations = catalog.ex_variations.filter(
    (v) =>
      published(v) &&
      exercises.some((e) => e.id === v.exercise_id) &&
      (!v.region_id || v.region_id === regionId),
  );
  const needle = normalizeExerciseName(query);
  if (!needle) return { status: "missing" as const, candidates: [] };
  const matches = catalog.ex_aliases.filter(
    (a) =>
      published(a) &&
      normalizeExerciseName(a.alias) === needle &&
      (!a.region_id || a.region_id === regionId) &&
      (!a.variation_id ||
        variations.some(
          (v) =>
            v.id === a.variation_id &&
            v.exercise_id === a.exercise_id &&
            (!v.region_id || v.region_id === a.region_id),
        )),
  );
  const regional = matches.filter(
    (a) => a.region_id === regionId && !!regionId,
  );
  const candidates: Candidate[] = [];
  for (const e of exercises) {
    if (
      !regional.length &&
      (e.id === query || normalizeExerciseName(e.name) === needle)
    )
      candidates.push({ exercise: e, variation: null });
    for (const a of regional.length
      ? regional
      : matches.filter((a) => !a.region_id)) {
      if (a.exercise_id === e.id)
        candidates.push({
          exercise: e,
          variation: a.variation_id
            ? variations.find((v) => v.id === a.variation_id)!
            : null,
        });
    }
    if (!regional.length)
      for (const v of variations)
        if (
          v.exercise_id === e.id &&
          (v.id === query || normalizeExerciseName(v.name) === needle)
        )
          candidates.push({ exercise: e, variation: v });
  }
  const unique = [
    ...new Map(
      candidates.map((c) => [c.exercise.id + ":" + (c.variation?.id ?? ""), c]),
    ).values(),
  ].sort((a, b) =>
    (a.exercise.id + (a.variation?.id ?? "")).localeCompare(
      b.exercise.id + (b.variation?.id ?? ""),
    ),
  );
  let options = unique;
  if (variationId)
    options = unique
      .flatMap((c) => {
        const v = variations.find(
          (v) => v.id === variationId && v.exercise_id === c.exercise.id,
        );
        return v ? [{ exercise: c.exercise, variation: v }] : [];
      })
      .filter(
        (c, i, all) =>
          all.findIndex(
            (x) =>
              x.exercise.id === c.exercise.id &&
              x.variation?.id === c.variation?.id,
          ) === i,
      );
  if (!options.length) return { status: "missing" as const, candidates: [] };
  if (options.length > 1)
    return { status: "ambiguous" as const, candidates: options };
  const selected = options[0];
  const rules = catalog.ex_counting_conventions.filter(
    (c) =>
      published(c) &&
      c.exercise_id === selected.exercise.id &&
      (!c.region_id || c.region_id === regionId) &&
      (!c.variation_id || c.variation_id === selected.variation?.id),
  );
  const specific =
    selected.variation &&
    rules.some((c) => c.variation_id === selected.variation?.id)
      ? rules.filter((c) => c.variation_id === selected.variation?.id)
      : rules.filter((c) => !c.variation_id);
  const counting = specific.some((c) => !!regionId && c.region_id === regionId)
    ? specific.filter((c) => c.region_id === regionId)
    : specific.filter((c) => !c.region_id);
  const equipment =
    selected.variation?.equipment_mode === "replace"
      ? catalog.ex_variation_equipment.filter(
          (r) => r.variation_id === selected.variation?.id,
        )
      : catalog.ex_exercise_equipment.filter(
          (r) => r.exercise_id === selected.exercise.id,
        );
  const facilities =
    selected.variation?.facility_mode === "replace"
      ? catalog.ex_variation_facilities.filter(
          (r) => r.variation_id === selected.variation?.id,
        )
      : catalog.ex_exercise_facilities.filter(
          (r) => r.exercise_id === selected.exercise.id,
        );
  return {
    status: "matched" as const,
    ...selected,
    counting,
    countingNeedsConfirmation:
      counting.length !== 1 || counting[0].convention === "unknown",
    requirements: {
      equipment: equipment.filter((r) => r.required).map((r) => r.equipment_id),
      facilities: facilities.filter((r) => r.required).map((r) => r.amenity_id),
    },
  };
}
