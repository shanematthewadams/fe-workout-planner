import { createHash } from "node:crypto";
import { z } from "zod";
import { movements } from "../src/movements.ts";
import {
  buildAppExicon,
  exiconImportSQL,
  validateExiconCatalog,
} from "./exicon-catalog.ts";
import { normalizeExerciseName } from "../src/exicon-catalog.ts";
const sourceId = "f3-q-builder-reviewed-planner-v1";
const stamp = "2026-11-10T00:00:00.000Z";
const sourceURL =
  "https://github.com/shanematthewadams/fe-workout-planner/blob/c463ffafc2b00089b48564c34755a220e709da50/src/movements.ts";
const decisionSchema = z
  .object({
    target_kind: z.enum(["exercise", "format"]),
    target_id: z.string().min(1),
    app_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    state: z.enum(["approved", "unmapped"]),
    entry_id: z.string().min(1).nullable(),
    entry_fingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    entry_text_fingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    relation: z.enum(["equivalent", "local-adaptation"]).nullable(),
    notes: z.string().min(10),
  })
  .strict();
export const plannerReviewSchema = z
  .object({
    version: z.literal(1),
    reviewed_at: z.string().datetime({ offset: true }),
    reviewed_by: z.string().min(1),
    decisions: z.array(decisionSchema).max(500),
  })
  .strict();
export function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJSON).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stableJSON(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const definitionFingerprint = (value: unknown) =>
  createHash("sha256").update(stableJSON(value)).digest("hex");
export function plannerDefinitions() {
  const app = buildAppExicon();
  return [
    ...movements.map((m) => ({ kind: "exercise", id: m.id, definition: m })),
    ...app.ex_formats.map((f) => ({
      kind: "format",
      id: f.id,
      definition: {
        format: f,
        parameters: app.ex_format_parameters.filter(
          (p) => p.format_id === f.id,
        ),
      },
    })),
  ];
}
export function buildReviewedPlannerCatalog() {
  const catalog = buildAppExicon();
  catalog.ao_sources.push({
    id: sourceId,
    kind: "review",
    url: sourceURL,
    captured_at: stamp,
    description:
      "Existing app planning conventions reviewed for live catalog use. Canonical mechanics/counting/requirements retained; Codex links have a separate fingerprint-bound review.",
  });
  catalog.ex_source_licenses.push({
    source_id: sourceId,
    license_name:
      "Internal publication authorization under Shane's 2026-11-04 product decision; upstream terms unresolved",
    permission_url:
      "https://github.com/shanematthewadams/fe-workout-planner/blob/c463ffafc2b00089b48564c34755a220e709da50/data/codex-reuse-decision.json",
    reviewed_at: stamp,
    redistribution_allowed: true,
  });
  const common = {
    source_id: sourceId,
    publication_status: "published" as const,
    revision: 1,
    protected: false,
  };
  for (const m of movements) {
    if (catalog.ex_exercises.some((e) => e.id === m.id)) continue; // Preserve the original eight/source decisions unchanged.
    catalog.ex_exercises.push({
      ...common,
      id: m.id,
      name: m.name,
      instructions: m.instructions,
      movement_category: m.category,
      running: m.running,
      alternative: m.alternative,
    });
    const aliases = [
      ...new Map(m.aliases.map((a) => [normalizeExerciseName(a), a])).values(),
    ];
    for (const [i, alias] of aliases.entries())
      catalog.ex_aliases.push({
        ...common,
        id: `${m.id}:app-alias:${i + 1}`,
        exercise_id: m.id,
        variation_id: null,
        region_id: null,
        alias,
      });
    catalog.ex_counting_conventions.push({
      ...common,
      id: `${m.id}:app-counting`,
      exercise_id: m.id,
      variation_id: null,
      region_id: null,
      convention: /seconds|timed hold/i.test(m.counting)
        ? "time"
        : /distance per leg|one-way and total travel distance/i.test(m.counting)
          ? "distance"
          : "unknown",
      cycle_description: m.counting,
      count_on: null,
    });
    for (const e of m.equipment) {
      const id = { Coupon: "coupon", Weight: "portable-weight" }[e];
      if (!id) throw Error("Unsupported equipment review");
      catalog.ex_exercise_equipment.push({
        exercise_id: m.id,
        equipment_id: id,
        required: true,
      });
    }
    for (const f of m.features) {
      const id: string | undefined = (
        {
          benches: "benches",
          walls: "workout-walls",
          pullupBars: "pull-up-bars",
        } as Record<string, string>
      )[f];
      if (!id) throw Error("Unsupported facility review");
      catalog.ex_exercise_facilities.push({
        exercise_id: m.id,
        amenity_id: id,
        required: true,
      });
    }
  }
  return validateExiconCatalog(catalog);
}
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
export function prepareReviewedPlanner(
  reviewInput: unknown,
  sourceInput: unknown,
) {
  const review = plannerReviewSchema.parse(reviewInput);
  const sources = z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .parse(sourceInput);
  const sourceById = new Map(sources.map((e) => [e.id, e]));
  if (sourceById.size !== sources.length)
    throw Error("Duplicate source identity");
  const definitions = plannerDefinitions(),
    seen = new Set<string>();
  for (const d of review.decisions) {
    const key = d.target_kind + ":" + d.target_id;
    if (seen.has(key)) throw Error("Duplicate review target");
    seen.add(key);
    const target = definitions.find(
      (t) => t.kind === d.target_kind && t.id === d.target_id,
    );
    if (
      !target ||
      definitionFingerprint(target.definition) !== d.app_fingerprint
    )
      throw Error("App definition changed; re-review " + key);
    if (d.state === "approved") {
      const source = sourceById.get(d.entry_id ?? "");
      if (
        !source ||
        source.fingerprint !== d.entry_fingerprint ||
        definitionFingerprint({
          name: source.name,
          description: source.description,
        }) !== d.entry_text_fingerprint ||
        !d.relation
      )
        throw Error("Codex entry changed or missing; re-review " + key);
    } else if (
      d.entry_id !== null ||
      d.entry_fingerprint !== null ||
      d.entry_text_fingerprint !== null ||
      d.relation !== null
    )
      throw Error("Unmapped targets cannot imply a source identity");
  }
  if (seen.size !== definitions.length)
    throw Error(
      "Every current exercise/format needs an explicit review decision",
    );
  const catalog = buildReviewedPlannerCatalog();
  // Existing operator publication decisions/overrides are retained by the base importer.
  // Assert all expected canonical fields, requirements/counts/aliases before binding their review hash.
  let sql = exiconImportSQL(catalog).replace(/commit;\s*$/, "");
  sql = sql.replace(
    "begin;",
    "begin;\nset local lock_timeout='5s';\nlock table public.ex_exercises,public.ex_aliases,public.ex_counting_conventions,public.ex_exercise_equipment,public.ex_exercise_facilities,public.ex_formats,public.ex_format_parameters,public.ex_codex_entries,public.ex_codex_planner_links in share row exclusive mode;",
  );
  sql +=
    "\ncreate temporary table planner_review_assertions(ok boolean not null check(ok)) on commit drop;\n";
  for (const [table, keys] of Object.entries({
    ex_exercises: ["id"],
    ex_aliases: ["id"],
    ex_counting_conventions: ["id"],
    ex_exercise_equipment: ["exercise_id", "equipment_id"],
    ex_exercise_facilities: ["exercise_id", "amenity_id"],
    ex_formats: ["id"],
    ex_format_parameters: ["format_id", "parameter_key"],
  })) {
    const rows = catalog[table as keyof typeof catalog] as Record<
      string,
      unknown
    >[];
    const json = quote(JSON.stringify(rows));
    // JSON containment permits generated columns but never a different reviewed field.
    const match = keys
      .map((k) => `to_jsonb(c)->>'${k}'=i->>'${k}'`)
      .join(" and ");
    sql += `insert into planner_review_assertions select not exists(select 1 from jsonb_array_elements(${json}::jsonb) i where not exists(select 1 from public.${table} c where ${match} and to_jsonb(c) @> i));\n`;
    const parentField =
      table === "ex_exercises" || table === "ex_formats"
        ? "id"
        : table === "ex_format_parameters"
          ? "format_id"
          : "exercise_id";
    const parents =
      table === "ex_formats" || table === "ex_format_parameters"
        ? catalog.ex_formats.map((f) => f.id)
        : catalog.ex_exercises.map((e) => e.id);
    sql += `insert into planner_review_assertions select not exists(select 1 from public.${table} c where c.${parentField} in (${parents.map(quote).join(",")}) and not exists(select 1 from jsonb_array_elements(${json}::jsonb) i where ${match} and to_jsonb(c) @> i));\n`;
  }
  const approved = review.decisions.filter((d) => d.state === "approved");
  for (const d of approved) {
    const exercise = d.target_kind === "exercise" ? quote(d.target_id) : "null",
      format = d.target_kind === "format" ? quote(d.target_id) : "null";
    const source = sourceById.get(d.entry_id!)!;
    sql += `insert into planner_review_assertions select exists(select 1 from public.ex_codex_entries e join public.ex_codex_reuse r on r.source_id=e.source_id where e.id=${quote(d.entry_id!)} and e.fingerprint=${quote(d.entry_fingerprint!)} and e.name=${quote(source.name)} and e.description=${quote(source.description)} and e.present and r.enabled);\n`;
    sql += `insert into public.ex_codex_planner_links(id,exercise_id,format_id,entry_id,entry_fingerprint,entry_text_fingerprint,planning_fingerprint,relation,reviewed_at,reviewed_by,notes) values(${quote(d.target_kind + ":" + d.target_id)},${exercise},${format},${quote(d.entry_id!)},${quote(d.entry_fingerprint!)},public.fe_codex_text_review_fingerprint(${quote(d.entry_id!)}),public.fe_exicon_review_fingerprint(${exercise},${format}),${quote(d.relation!)},${quote(review.reviewed_at)},${quote(review.reviewed_by)},${quote(d.notes)}) on conflict(id) do update set entry_text_fingerprint=excluded.entry_text_fingerprint where ex_codex_planner_links.entry_text_fingerprint is null and ex_codex_planner_links.enabled and ex_codex_planner_links.entry_id=excluded.entry_id and ex_codex_planner_links.entry_fingerprint=excluded.entry_fingerprint and ex_codex_planner_links.planning_fingerprint=excluded.planning_fingerprint and ex_codex_planner_links.relation=excluded.relation;\n`;
    sql += `insert into planner_review_assertions select exists(select 1 from public.ex_codex_planner_links l where l.id=${quote(d.target_kind + ":" + d.target_id)} and l.enabled and l.entry_id=${quote(d.entry_id!)} and l.entry_fingerprint=${quote(d.entry_fingerprint!)} and l.entry_text_fingerprint=public.fe_codex_text_review_fingerprint(l.entry_id) and l.planning_fingerprint=public.fe_exicon_review_fingerprint(${exercise},${format}) and l.relation=${quote(d.relation!)});\n`;
  }
  sql +=
    "select jsonb_build_object('exercises',(select count(*) from public.ex_exercises),'reviewed_links',(select count(*) from public.ex_codex_planner_links)) as result;\ncommit;\n";
  return {
    catalog,
    sql,
    report: {
      exercises: catalog.ex_exercises.length,
      newExercises: 42,
      links: approved.length,
      exerciseLinks: approved.filter((d) => d.target_kind === "exercise")
        .length,
      formatLinks: approved.filter((d) => d.target_kind === "format").length,
      referenceDescriptions: approved.filter((d) => d.relation === "equivalent")
        .length,
      unmapped: review.decisions
        .filter((d) => d.state === "unmapped")
        .map((d) => ({
          kind: d.target_kind,
          id: d.target_id,
          reason: d.notes,
        })),
      regionalCountingOverwritten: false,
      sourceAliasAutoMerge: false,
    },
  };
}
