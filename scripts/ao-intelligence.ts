import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Row = Record<string, string | number | boolean | null>;
export type Catalog = Record<string, Row[]>;
export type Issue = { kind: string; key: string; detail: string };
type Snapshot = {
  sourceUrl: string;
  capturedOn: string;
  values: (string | number | null)[][];
};
const root = new URL("../", import.meta.url);
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));
export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function records(snapshot: Snapshot) {
  const header = snapshot.values.findIndex((r) => r[0] === "AO");
  if (header < 0) throw Error("Missing AO header");
  return snapshot.values
    .slice(header + 1)
    .filter((r) => r[0])
    .map((r, i) => ({
      row: header + i + 2,
      data: Object.fromEntries(
        snapshot.values[header].map((h, j) => [
          String(h),
          String(r[j] ?? "").trim(),
        ]),
      ) as Record<string, string>,
    }));
}
/** Reviewed evidence map: only specific prose-supported on-site features. Never trusts Yes/No cells. */
const present: Record<string, string[]> = {
  "Black Bob Park": [
    "Basketball court",
    "Pull-up bars",
    "Playground equipment",
    "Bleachers",
    "Picnic tables",
    "Benches",
    "Workout walls",
    "Covered shelter",
    "Parking lot",
    "Grass field",
    "Paved trail / sidewalk",
    "Dirt trail",
    "Curbs / platforms",
    "Sprint straightaway",
  ],
  "Brougham Elementary": ["Basketball court", "Playground equipment"],
  "Olathe South High School": [
    "Stairs / stadium steps",
    "Running track",
    "Tennis court",
    "Picnic tables",
    "Benches",
    "Parking lot",
    "Grass field",
    "Curbs / platforms",
  ],
  "Frontier Trail Middle School": [
    "Running track",
    "Grass field",
    "Bleachers",
    "Parking lot",
  ],
  "California Trail Middle School": [
    "Stairs / stadium steps",
    "Running track",
    "Grass field",
    "Picnic tables",
    "Covered shelter",
    "Steep hill",
    "Workout walls",
    "Parking lot",
  ],
  "Olathe Community Center / Stagecoach Park": [
    "Stairs / stadium steps",
    "Covered shelter",
    "Picnic tables",
    "Paved trail / sidewalk",
    "Workout walls",
    "Playground equipment",
    "Parking lot",
    "Grass field",
  ],
  "Heartland Community Church": [
    "Benches",
    "Workout walls",
    "Parking lot",
    "Grass field",
    "Parking garage",
  ],
  "Sunnyside Elementary": [
    "Running track",
    "Basketball court",
    "Playground equipment",
    "Benches",
    "Workout walls",
    "Covered shelter",
    "Gentle hill",
  ],
  "Oregon Trail Park": [
    "Pull-up bars",
    "Playground equipment",
    "Bleachers",
    "Workout walls",
    "Covered shelter",
    "Restrooms",
    "Paved trail / sidewalk",
    "Lake / waterfront",
  ],
  "Johnson County Square": [
    "Stairs / stadium steps",
    "Parking garage",
    "Grass field",
  ],
};
export function buildCatalog(snapshots?: {
  directory: Snapshot;
  amenities: Snapshot;
  landmarks: Snapshot;
}) {
  const directory =
    snapshots?.directory ??
    read("data/ao-intelligence/sheet-ao-directory.json");
  const amenities =
    snapshots?.amenities ?? read("data/ao-intelligence/sheet-amenities.json");
  const landmarks =
    snapshots?.landmarks ?? read("data/ao-intelligence/sheet-landmarks.json");
  const official: { id: string; name: string }[] = read(
    "data/ao-official.json",
  );
  const nation = read("data/ao-nation.json") as {
    regionId: number;
    checkedAt: string;
    sourceUrl: string;
    aos: {
      localId: string;
      nationOrgId: number;
      defaultLocation?: {
        id: number;
        locationName: string;
        latitude: number;
        longitude: number;
      };
    }[];
  };
  // Reviewed immutable IDs. New names require explicit alias reconciliation, not a new slug.
  const venueIdentities = read(
    "data/ao-intelligence/venue-identities.json",
  ) as Record<string, string>;
  const venueId = (name: string) => {
    const id = venueIdentities[name];
    if (!id) throw Error("Unreconciled venue name: " + name);
    return id;
  };
  const catalog: Catalog = {};
  const issues: Issue[] = [];
  const add = (table: string, row: Row) => {
    const rows = (catalog[table] ??= []);
    const key = row.id ?? row.ao_id ?? row.nation_location_id;
    const old = rows.find(
      (r) => (r.id ?? r.ao_id ?? r.nation_location_id) === key,
    );
    if (old && JSON.stringify(old) !== JSON.stringify(row))
      issues.push({
        kind: "duplicate_conflict",
        key: `${table}:${key}`,
        detail: "Conflicting source rows; first retained for reconciliation.",
      });
    else if (!old) rows.push(row);
  };
  const sourceId =
    "inventory-" +
    createHash("sha256")
      .update(JSON.stringify({ directory, amenities, landmarks }))
      .digest("hex")
      .slice(0, 16);
  add("ao_sources", {
    id: sourceId,
    kind: "local_inventory",
    url: directory.sourceUrl,
    captured_at: directory.capturedOn + "T00:00:00Z",
    description:
      "Three-tab inventory snapshot; cell defaults are unverified. Capture date is not site verification.",
  });
  add("ao_sources", {
    id: "nation-" + nation.checkedAt,
    kind: "nation",
    url: nation.sourceUrl,
    captured_at: nation.checkedAt,
    description:
      "Repository Nation snapshot; default location pins do not select seasonal venues.",
  });
  const nationSource = "nation-" + nation.checkedAt;
  add("ao_regions", {
    id: "the-fe",
    name: "The FE",
    nation_org_id: nation.regionId,
    source_id: nationSource,
  });
  const aoByName = new Map<string, string>();
  for (const r of records(directory)) {
    const d = r.data;
    const match = official.find(
      (a) =>
        slug(a.name) === slug(d.AO) ||
        (d.AO === "South Stride" && a.id === "fe-ao-southstride"),
    );
    if (!match) throw Error("Unmatched AO: " + d.AO);
    aoByName.set(d.AO, match.id);
    const upstream = nation.aos.find((a) => a.localId === match.id);
    if (!upstream)
      issues.push({
        kind: "missing_nation",
        key: match.id,
        detail: "Official Nation org reference unresolved.",
      });
    const mode =
      d.AO === "Vagabonds"
        ? "rotating"
        : d.AO === "South Park"
          ? "site_q_selected"
          : "fixed";
    add("ao_sites", {
      id: match.id,
      region_id: "the-fe",
      name: d.AO,
      nation_org_id: upstream?.nationOrgId ?? null,
      activity:
        d["AO type"] === "Run/Ruck"
          ? "run"
          : d["AO type"] === "Ruck"
            ? "ruck"
            : "bootcamp",
      ruck_option: d["AO type"] === "Run/Ruck",
      location_mode: mode,
      planning_mode: d["Planning mode"],
      warmup: d.Warmup,
      mary: d.Mary,
      cot: d.COT,
      schedule_reference: d["Source URL"],
      source_id: sourceId,
    });
    if (mode !== "rotating") {
      const vid = venueId(d.Venue);
      // Shared venue prose is AO specific in the source; retain all observations in report, not last-writer-wins.
      const existing = catalog.ao_venues?.find((v) => v.id === vid);
      if (!existing)
        add("ao_venues", {
          id: vid,
          name: d.Venue,
          address: d.Address || null,
          lighting: d.Lighting || null,
          access_notes: d["Access / restrictions"] || null,
          terrain_notes: d.Surfaces || null,
          source_id: sourceId,
        });
      else if (existing.address !== d.Address)
        issues.push({
          kind: "venue_address",
          key: vid,
          detail: `${existing.address} versus ${d.Address}`,
        });
      if (
        existing &&
        [
          d.Lighting || null,
          d["Access / restrictions"] || null,
          d.Surfaces || null,
        ].some(
          (value, index) =>
            value !==
            [existing.lighting, existing.access_notes, existing.terrain_notes][
              index
            ],
        )
      )
        issues.push({
          kind: "shared_venue_observations",
          key: vid,
          detail: `${d.AO}: differing notes retained on its venue assignment; venue-level summary needs reconciliation.`,
        });
      add("ao_venue_assignments", {
        id: match.id + ":" + vid,
        ao_id: match.id,
        venue_id: vid,
        meeting_point: d["Meeting / flag description"],
        lighting_notes: d.Lighting || null,
        access_notes: d["Access / restrictions"] || null,
        terrain_notes: d.Surfaces || null,
        route_notes: d["Routes / distance"] || null,
        local_notes: d["Site Q notes"] || null,
        precision: d["Flag precision"],
        season_label: d["Season / active location"],
        selection: mode === "site_q_selected" ? "site_q_required" : "default",
        source_id: sourceId,
      });
    }
    if (upstream?.defaultLocation && mode !== "rotating") {
      const l = upstream.defaultLocation;
      add("ao_official_locations", {
        nation_location_id: l.id,
        name: l.locationName,
        latitude: l.latitude,
        longitude: l.longitude,
        source_id: nationSource,
      });
      add("ao_nation_defaults", { ao_id: match.id, nation_location_id: l.id });
    } else if (mode === "rotating" && upstream?.defaultLocation)
      issues.push({
        kind: "rotating_pin_excluded",
        key: match.id,
        detail:
          "Nation default retained in source snapshot only; never a permanent Vagabonds venue.",
      });
  }
  const amenityHeader = amenities.values
    .find((r: (string | number | null)[]) => r[0] === "AO")!
    .map(String);
  const columns = amenityHeader.slice(
    3,
    amenityHeader.indexOf("Facilities notes"),
  );
  for (const column of columns)
    add("ao_amenity_types", { id: slug(column), name: column });
  for (const r of records(amenities)) {
    const d = r.data;
    if (d.AO === "Vagabonds") {
      issues.push({
        kind: "mobile_amenities_excluded",
        key: d.AO,
        detail: "No fixed venue; legacy flags not imported.",
      });
      continue;
    }
    const vid = venueId(d.Venue);
    if (!catalog.ao_venues.some((v) => v.id === vid))
      throw Error("Amenity venue missing directory assignment: " + d.Venue);
    for (const column of columns) {
      const restricted =
        d.Venue === "Olathe South High School" && column === "Artificial turf";
      const confirmed = present[d.Venue]?.includes(column) ?? false;
      const availability = restricted
        ? "restricted"
        : confirmed
          ? "present"
          : "unknown";
      const id = vid + ":" + slug(column);
      const old = catalog.ao_venue_amenities?.find((a) => a.id === id);
      if (!old)
        add("ao_venue_amenities", {
          id,
          venue_id: vid,
          amenity_id: slug(column),
          availability,
          verification: confirmed || restricted ? "reported" : "unverified",
          evidence: `Reviewed prose-supported feature map in scripts/ao-intelligence.ts; see all AO Directory and Amenities rows for this shared venue. Amenities row ${r.row}; ${d.AO}. Raw cell ${column}=${d[column]}. ${d["Facilities notes"]} ${d["Terrain notes"]} Caveat: ${d["Verification caveat"]}`,
          source_id: sourceId,
        });
      if (availability === "unknown" && /^(Yes|No)$/.test(d[column]))
        issues.push({
          kind: "unverified_default",
          key: `${d.AO}:${column}`,
          detail: `${d[column]} retained as unknown. ${d["Verification caveat"]}`,
        });
    }
  }
  for (const r of records(landmarks)) {
    const d = r.data,
      ao = aoByName.get(d.AO);
    if (!ao) throw Error("Unmatched landmark AO " + d.AO);
    const nearby =
      /nearby/i.test(d.Type) ||
      /off-site|across.the.street|across.street|within running distance|short mosey/i.test(
        d["Description / location"] +
          " " +
          d["Additional notes"] +
          " " +
          d["Restrictions / safety"],
      );
    const assignments = catalog.ao_venue_assignments.filter(
      (a) => a.ao_id === ao,
    );
    const uncertainLocation = /at or near/i.test(d["Description / location"]);
    const venue =
      nearby || uncertainLocation
        ? null
        : d.AO === "South Park"
          ? assignments.find((a) => a.venue_id === "brougham-elementary")
              ?.venue_id
          : assignments.length === 1
            ? assignments[0].venue_id
            : null;
    const id = ao + ":" + slug(d["Landmark name"]);
    add("ao_landmarks", {
      id,
      name: d["Landmark name"],
      venue_id: venue ?? null,
      description: d["Description / location"],
      kind: d.Type,
      use_cases: d["Good for"],
      surface: d.Surface || null,
      lighting: d.Lighting || null,
      restrictions: d["Restrictions / safety"] || null,
      precision: "description_only",
      verification: d["Site Q verified?"] === "Yes" ? "reported" : "unverified",
      source_id: sourceId,
      evidence: `Landmarks row ${r.row}. ${d["Additional notes"]}`,
    });
    add("ao_landmark_links", {
      id,
      ao_id: ao,
      landmark_id: id,
      proximity: nearby ? "nearby" : venue ? "on_site" : "unknown",
    });
  }
  return { catalog, issues };
}
const identifier = (s: string) => {
  if (!/^[a-z_]+$/.test(s)) throw Error("Unsafe SQL identifier");
  return '"' + s + '"';
};
const literal = (v: Row[string]) =>
  v === null
    ? "NULL"
    : typeof v === "string"
      ? "'" + v.replaceAll("'", "''") + "'"
      : String(v);
/** Transactional insert-only seed. Existing local overrides are never overwritten, even by fresher imports.
 * A temp report exposes every differing existing row; admin resolution is a separate reviewed action. */
export function importSQL(catalog: Catalog) {
  let sql =
    "begin;\ncreate temporary table ao_import_conflicts(table_name text, record_key text) on commit drop;\n";
  for (const [table, rows] of Object.entries(catalog))
    for (const row of rows) {
      const keys = Object.keys(row),
        key = keys.includes("id")
          ? "id"
          : keys.includes("ao_id")
            ? "ao_id"
            : "nation_location_id";
      const naturalKeys: Record<string, string[][]> = {
        ao_regions: [["nation_org_id"]],
        ao_sites: [["nation_org_id"], ["region_id", "name"]],
        ao_venues: [["name", "address"]],
        ao_venue_assignments: [["ao_id", "venue_id"]],
        ao_amenity_types: [["name"]],
        ao_venue_amenities: [["venue_id", "amenity_id"]],
        ao_landmark_links: [["ao_id", "landmark_id"]],
      };
      const matches = [[key], ...(naturalKeys[table] ?? [])]
        .filter((group) =>
          group.every((k) => row[k] !== null && row[k] !== undefined),
        )
        .map(
          (group) =>
            "(" +
            group
              .map((k) => `${identifier(k)}=${literal(row[k])}`)
              .join(" and ") +
            ")",
        )
        .join(" or ");
      const where = keys
        .map((k) => `${identifier(k)} is not distinct from ${literal(row[k])}`)
        .join(" and ");
      sql += `insert into ao_import_conflicts select ${literal(table)},${literal(String(row[key]))} from public.${identifier(table)} where (${matches}) and not (${where});\n`;
      sql += `insert into public.${identifier(table)} (${keys.map(identifier).join(",")}) values (${keys.map((k) => literal(row[k])).join(",")}) on conflict do nothing;\n`;
    }
  return (
    sql +
    "select * from ao_import_conflicts order by table_name,record_key;\ncommit;\n"
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // This tool only writes files: it cannot connect to production or create infrastructure.
  const { catalog, issues } = buildCatalog();
  if (issues.some((i) => i.kind === "duplicate_conflict"))
    throw Error(
      "Conflicting source records: resolve duplicate_conflict entries before preparing a seed.",
    );
  mkdirSync(new URL("../qa/ao-intelligence/", import.meta.url), {
    recursive: true,
  });
  writeFileSync(
    new URL("../qa/ao-intelligence/import.sql", import.meta.url),
    importSQL(catalog),
  );
  writeFileSync(
    new URL("../qa/ao-intelligence/reconciliation.json", import.meta.url),
    JSON.stringify(
      {
        counts: Object.fromEntries(
          Object.entries(catalog).map(([k, v]) => [k, v.length]),
        ),
        issues,
      },
      null,
      2,
    ),
  );
  console.log(
    "Prepared SQL and reconciliation report in qa/ao-intelligence; no database connection made.",
  );
}
