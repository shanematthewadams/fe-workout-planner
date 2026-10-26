import { appAuthoredMovements } from "../src/app-movements.ts";
import {
  exiconCatalogSchema,
  type ExiconCatalog,
} from "../src/exicon-catalog.ts";
export const EXICON_TABLE_KEYS = {
  ao_sources: ["id"],
  ex_source_licenses: ["source_id"],
  ex_exercises: ["id"],
  ex_variations: ["id"],
  ex_aliases: ["id"],
  ex_counting_conventions: ["id"],
  ex_equipment_types: ["id"],
  ex_exercise_equipment: ["exercise_id", "equipment_id"],
  ex_exercise_facilities: ["exercise_id", "amenity_id"],
  ex_variation_equipment: ["variation_id", "equipment_id"],
  ex_variation_facilities: ["variation_id", "amenity_id"],
  ex_formats: ["id"],
  ex_format_parameters: ["format_id", "parameter_key"],
} as const;
export function validateExiconCatalog(input: unknown): ExiconCatalog {
  const data = exiconCatalogSchema.parse(input);
  for (const [table, keys] of Object.entries(EXICON_TABLE_KEYS)) {
    const seen = new Set<string>();
    for (const row of data[table as keyof typeof EXICON_TABLE_KEYS]) {
      const r = row as Record<string, unknown>;
      const key = JSON.stringify(keys.map((k) => r[k]));
      if (seen.has(key)) throw Error(`Duplicate ${table} identity ${key}`);
      seen.add(key);
    }
  }
  return data;
}
const stamp = "2026-10-26T00:00:00.000Z";
const sourceId = "f3-q-builder-app-exercises-v1";
const sourceUrl =
  "https://github.com/shanematthewadams/fe-workout-planner/blob/f892bb3/src/movements.ts";
/** Only the separate eight app-written descriptions; no EXICON_DATABASE entries. */
export function buildAppExicon(): ExiconCatalog {
  const common = {
    source_id: sourceId,
    publication_status: "published" as const,
    revision: 1,
    protected: false,
  };
  const facilities: Record<string, string> = {
    walls: "workout-walls",
    pullupBars: "pull-up-bars",
  };
  const equipment: Record<string, string> = {
    Coupon: "coupon",
    Weight: "portable-weight",
  };
  const catalog: ExiconCatalog = {
    version: 1,
    ao_sources: [
      {
        id: sourceId,
        kind: "review",
        url: sourceUrl,
        captured_at: stamp,
        description:
          "Eight app-written movement descriptions separated from the bundled reference. Existing planning conventions only; no official Exicon import.",
      },
    ],
    ex_source_licenses: [
      {
        source_id: sourceId,
        license_name:
          "Project-authored application text; not an upstream Exicon license",
        permission_url: sourceUrl,
        reviewed_at: stamp,
        redistribution_allowed: true,
      },
    ],
    ex_exercises: appAuthoredMovements.map((m) => ({
      ...common,
      id: m.id,
      name: m.name,
      instructions: m.instructions,
      movement_category: m.category,
      running: m.running,
      alternative: m.alternative,
    })),
    ex_variations: [],
    ex_aliases: appAuthoredMovements.flatMap((m) =>
      m.aliases.map((alias, i) => ({
        ...common,
        id: `${m.id}:alias:${i + 1}`,
        exercise_id: m.id,
        variation_id: null,
        region_id: null,
        alias,
      })),
    ),
    ex_counting_conventions: appAuthoredMovements.map((m) => ({
      ...common,
      id: `${m.id}:counting`,
      exercise_id: m.id,
      variation_id: null,
      region_id: null,
      convention: ["plank", "wall-sit"].includes(m.id)
        ? "time"
        : ["squat", "ww3"].includes(m.id)
          ? "1=1"
          : "unknown",
      cycle_description: m.counting,
      count_on: null,
    })),
    ex_equipment_types: Object.entries(equipment).map(([name, id]) => ({
      id,
      name,
    })),
    ex_exercise_equipment: appAuthoredMovements.flatMap((m) =>
      m.equipment.map((e) => ({
        exercise_id: m.id,
        equipment_id: equipment[e],
        required: true,
      })),
    ),
    ex_exercise_facilities: appAuthoredMovements.flatMap((m) =>
      m.features.map((f) => ({
        exercise_id: m.id,
        amenity_id: facilities[f],
        required: true,
      })),
    ),
    ex_variation_equipment: [],
    ex_variation_facilities: [],
    ex_formats: [
      {
        ...common,
        id: "11s",
        name: "11s",
        instructions:
          "Alternate two Q-selected exercises. Decrease the first rep count and increase the second while keeping the stated pair total. Define traversal and the final pair before starting.",
      },
      {
        ...common,
        id: "ladder",
        name: "Ladder",
        instructions:
          "Change reps by the stated step after each round. Specify the start, ceiling, direction and stopping rule; include travel and recovery in the time budget.",
      },
    ],
    ex_format_parameters: [],
  };
  const formatSourceId = "f3-q-builder-app-formats-v1";
  const formatSourceUrl =
    "https://github.com/shanematthewadams/fe-workout-planner/blob/studio/ux-streamline/scripts/exicon-catalog.ts";
  catalog.ao_sources.push({
    id: formatSourceId,
    kind: "review",
    url: formatSourceUrl,
    captured_at: stamp,
    description:
      "Two newly app-written format definitions and typed parameters in the Exicon foundation sprint. No upstream descriptions copied; exact release commit recorded in docs/exicon/HANDOFF.md.",
  });
  catalog.ex_source_licenses.push({
    source_id: formatSourceId,
    license_name:
      "Project-authored format text; not an upstream Exicon license",
    permission_url: formatSourceUrl,
    reviewed_at: stamp,
    redistribution_allowed: true,
  });
  for (const format of catalog.ex_formats) format.source_id = formatSourceId;
  for (const [format, fields] of Object.entries({
    "11s": {
      first_reps: "integer",
      last_reps: "integer",
      pair_total: "integer",
      exercise_a: "text",
      exercise_b: "text",
      traversal: "text",
      stop_rule: "text",
    },
    ladder: {
      start: "integer",
      step: "integer",
      ceiling: "integer",
      direction: "text",
      stop_rule: "text",
    },
  })) {
    for (const [parameter_key, value_type] of Object.entries(fields))
      catalog.ex_format_parameters.push({
        format_id: format,
        parameter_key,
        value_type: value_type as "integer" | "text",
        required: true,
        minimum: value_type === "integer" ? 1 : null,
        maximum: null,
      });
  }
  return validateExiconCatalog(catalog);
}
const quote = (value: unknown) =>
  value === null
    ? "null"
    : typeof value === "boolean" || typeof value === "number"
      ? String(value)
      : "'" + String(value).replaceAll("'", "''") + "'";
/** Transactional SQL for an operator; never connects or executes, never deletes.
 * Permission decisions/requirements are insert-only. Protected, older, equal-version
 * conflicting or differently sourced records are retained and returned as conflicts.
 */
export function exiconImportSQL(input: unknown) {
  const catalog = validateExiconCatalog(input);
  const statements = [
    "begin;",
    "set local lock_timeout = '5s';",
    "set local statement_timeout = '30s';",
  ];
  for (const [table, keys] of Object.entries(EXICON_TABLE_KEYS)) {
    const rows = catalog[table as keyof typeof EXICON_TABLE_KEYS] as Record<
      string,
      unknown
    >[];
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    const values = rows
      .map((row) => "(" + columns.map((k) => quote(row[k])).join(",") + ")")
      .join(",\n");
    // Populate a typed temp copy so JSON comparison uses the actual column types.
    const tmp = "incoming_" + table;
    statements.push(
      `create temporary table ${tmp} (like public.${table} including defaults) on commit drop;`,
    );
    // LIKE DEFAULTS omits generated expressions; normalized_alias is never imported.
    statements.push(
      `insert into ${tmp} (${columns.join(",")}) values ${values};`,
    );
    const join = keys.map((k) => `current.${k}=incoming.${k}`).join(" and ");
    const mutable = columns.includes("revision");
    const canUpdate = mutable
      ? "not current.protected and current.source_id=incoming.source_id and current.revision < incoming.revision"
      : "false";
    const compare = columns
      .map((k) => `current.${k} is distinct from incoming.${k}`)
      .join(" or ");
    const key = keys.map((k) => `current.${k}`).join(" || ':' || ");
    statements.push(
      `select '${table}' as table_name, ${key} as record_key, 'existing decision retained' as reason from public.${table} current join ${tmp} incoming on ${join} where (${compare}) and not (${canUpdate});`,
    );
    const updates = mutable
      ? `do update set ${columns
          .filter((k) => !keys.includes(k as never) && k !== "protected")
          .map((k) => `${k}=excluded.${k}`)
          .join(
            ",",
          )} where not ${table}.protected and ${table}.source_id=excluded.source_id and ${table}.revision < excluded.revision`
      : "do nothing";
    statements.push(
      `insert into public.${table} (${columns.join(",")}) select ${columns.join(",")} from ${tmp} where true on conflict (${keys.join(",")}) ${updates};`,
    );
  }
  statements.push("commit;");
  return statements.join("\n");
}
