import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { buildCatalog, importSQL } from "../scripts/ao-intelligence.ts";
import {
  createAOReader,
  handleAOIntelligence,
  selectAOContext,
} from "../server/ao-intelligence.ts";
const migration = new URL(
  "../supabase/migrations/20261025175228_ao_intelligence_foundation.sql",
  import.meta.url,
);
const { catalog, issues } = buildCatalog();
async function database() {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role;",
  );
  await db.exec(await readFile(migration, "utf8"));
  await db.exec(importSQL(catalog));
  return db;
}
async function relationalRead(db: PGlite, id: string) {
  const { rows } = await db.query<{ data: unknown }>(
    `select to_jsonb(s)||jsonb_build_object(
 'ao_venue_assignments',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('ao_venues',to_jsonb(v)||jsonb_build_object('ao_venue_amenities',coalesce((select jsonb_agg(f) from ao_venue_amenities f where f.venue_id=v.id),'[]')))) from ao_venue_assignments a join ao_venues v on v.id=a.venue_id where a.ao_id=s.id),'[]'),
 'ao_landmark_links',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('ao_landmarks',to_jsonb(m))) from ao_landmark_links l join ao_landmarks m on m.id=l.landmark_id where l.ao_id=s.id),'[]')) as data from ao_sites s where s.id=$1`,
    [id],
  );
  return rows.map((r) => r.data);
}
describe("AO intelligence foundation", () => {
  it("imports current inventory, reconciles shared venues and retains unknown defaults", () => {
    expect(catalog.ao_sites).toHaveLength(16);
    expect(catalog.ao_venues).toHaveLength(13);
    const bay = catalog.ao_venue_assignments.find(
      (a) => a.ao_id === "fe-ao-baywatch",
    )!;
    const air = catalog.ao_venue_assignments.find(
      (a) => a.ao_id === "fe-ao-airfield",
    )!;
    expect(bay.venue_id).toBe(air.venue_id);
    expect(bay.meeting_point).toMatch(/Southwest/i);
    expect(air.meeting_point).toMatch(/Northernmost/);
    expect(
      catalog.ao_venue_assignments.filter(
        (a) => a.venue_id === "heritage-park-marina",
      ),
    ).toHaveLength(2);
    expect(
      catalog.ao_venue_assignments.filter(
        (a) => a.venue_id === "olathe-community-center-stagecoach-park",
      ),
    ).toHaveLength(2);
    expect(
      catalog.ao_venue_assignments.filter((a) => a.ao_id === "fe-ao-vagabonds"),
    ).toEqual([]);
    expect(
      catalog.ao_venue_amenities.find(
        (a) =>
          a.venue_id === "heritage-park-marina" &&
          a.amenity_id === "running-track",
      )?.availability,
    ).toBe("unknown");
    expect(
      catalog.ao_venue_amenities.find(
        (a) =>
          a.venue_id === "olathe-south-high-school" &&
          a.amenity_id === "artificial-turf",
      )?.availability,
    ).toBe("restricted");
    expect(
      catalog.ao_venue_amenities.find(
        (a) =>
          a.venue_id === "frontier-trail-middle-school" &&
          a.amenity_id === "playground-equipment",
      )?.availability,
    ).toBe("unknown");
    expect(
      issues.filter((i) => i.kind === "unverified_default").length,
    ).toBeGreaterThan(100);
    expect(issues.filter((i) => i.kind === "duplicate_conflict")).toEqual([]);
  });
  it("executes repeated imports, preserves overrides, reports conflicts and enforces relationships and RLS", async () => {
    const db = await database();
    try {
      const counts = async () =>
        Promise.all(
          Object.keys(catalog).map(
            async (table) =>
              (await db.query(`select count(*)::int as n from ${table}`)).rows,
          ),
        );
      const before = await counts();
      await db.exec(importSQL(catalog));
      expect(await counts()).toEqual(before);
      await db.exec(
        "update ao_venue_amenities set availability='absent',verification='reviewed' where id='heritage-park-marina:running-track'",
      );
      const imported = await db.exec(importSQL(catalog));
      expect(imported.flatMap((r) => r.rows)).toContainEqual({
        table_name: "ao_venue_amenities",
        record_key: "heritage-park-marina:running-track",
      });
      expect(
        (
          await db.query(
            "select availability from ao_venue_amenities where id='heritage-park-marina:running-track'",
          )
        ).rows,
      ).toEqual([{ availability: "absent" }]);
      await expect(
        db.exec(
          "update ao_venue_assignments set venue_id='nonexistent' where ao_id='fe-ao-baywatch'",
        ),
      ).rejects.toThrow(/foreign key/);
      await expect(
        db.exec(
          "update ao_venue_amenities set availability='absent',verification='unverified'",
        ),
      ).rejects.toThrow(/check constraint/);
      for (const role of ["anon", "authenticated"]) {
        await db.exec("set role " + role);
        expect((await db.query("select id from ao_sites")).rows).toHaveLength(
          16,
        );
        for (const table of Object.keys(catalog)) {
          await expect(db.exec(`delete from ${table}`)).rejects.toThrow(
            /permission denied/,
          );
          await expect(
            db.exec(
              `update ${table} set ${table === "ao_nation_defaults" ? "ao_id=ao_id" : table === "ao_official_locations" ? "name=name" : "id=id"}`,
            ),
          ).rejects.toThrow(/permission denied/);
        }
        await expect(
          db.exec(
            "insert into ao_regions(id,name,source_id) select 'attacker','Attacker',id from ao_sources limit 1",
          ),
        ).rejects.toThrow(/permission denied/);
        await db.exec("reset role");
      }
      await db.exec("set role service_role");
      await db.exec(
        "update ao_sites set name='Baywatch' where id='fe-ao-baywatch'",
      );
      await db.exec("reset role");
      const policies = await db.query(
        "select relname from pg_class where relname like 'ao_%' and relkind='r' and not relrowsecurity",
      );
      expect(policies.rows).toEqual([]);
    } finally {
      await db.close();
    }
  }, 30000);
  it("reads real relational contents with explicit venue selection, nearby separation, caching and fallback", async () => {
    const db = await database();
    let calls = 0,
      time = 0;
    try {
      const env = {
        enabled: "true",
        url: "https://isolated.supabase.co",
        publishableKey: "sb_publishable_fixture",
      };
      const fetcher: typeof fetch = async (input) => {
        calls++;
        const url = new URL(String(input));
        return new Response(
          JSON.stringify(
            await relationalRead(db, url.searchParams.get("id")!.slice(3)),
          ),
        );
      };
      const read = createAOReader(fetcher, () => time);
      const south = await read("fe-ao-south-park", env);
      expect(south).not.toBeNull();
      expect(selectAOContext(south!).venue).toBeNull();
      expect(selectAOContext(south!, "brougham-elementary").venue?.name).toBe(
        "Brougham Elementary",
      );
      expect(selectAOContext(south!, "wrong").venueRequired).toBe(true);
      const [a, b] = await Promise.all([
        read("fe-ao-pretty-bird", env),
        read("fe-ao-pretty-bird", env),
      ]);
      expect(a).toBe(b);
      expect(calls).toBe(2);
      const pretty = selectAOContext(a!);
      expect(
        pretty.usableAmenities.some((a) => a.amenity_id === "artificial-turf"),
      ).toBe(false);
      expect(
        pretty.usableAmenities.some((a) => a.amenity_id === "parking-garage"),
      ).toBe(false);
      expect(
        pretty.landmarks.find(
          (l) => l.ao_landmarks.name === "Garmin parking garage",
        )?.proximity,
      ).toBe("nearby");
      expect(
        selectAOContext((await read("fe-ao-vagabonds", env))!).venue,
      ).toBeNull();
      await read("fe-ao-pretty-bird", env);
      expect(calls).toBe(3);
      time = 61000;
      await read("fe-ao-pretty-bird", env);
      expect(calls).toBe(4);
      const response = await handleAOIntelligence(
        new Request(
          "https://staging.test/api/ao-intelligence?ao=fe-ao-pretty-bird",
        ),
        env,
        read,
      );
      expect((await response.json()).source).toBe("database");
      const disabled = await handleAOIntelligence(
        new Request(
          "https://staging.test/api/ao-intelligence?ao=fe-ao-pretty-bird",
        ),
        {},
        read,
      );
      expect((await disabled.json()).source).toBe("json");
      const invalid = createAOReader(async () => new Response("[{}]"));
      expect(await invalid("fe-ao-pretty-bird", env)).toBeNull();
      const failed = createAOReader(async () => {
        throw Error("Offline");
      });
      expect(await failed("fe-ao-pretty-bird", env)).toBeNull();
      expect(
        await read("fe-ao-pretty-bird", {
          ...env,
          publishableKey: "sb_secret_no",
        }),
      ).toBeNull();
    } finally {
      await db.close();
    }
  }, 30000);
  it("rolls back without affecting existing user/catalog tables and can reapply", async () => {
    const db = await database();
    try {
      await db.exec(
        "create table workouts(id text);create table beatdowns(id text);create table fe_profiles(user_id text);insert into workouts values('saved-catalog');insert into beatdowns values('owned-plan');insert into fe_profiles values('existing-profile');",
      );
      await db.exec(
        await readFile(
          new URL(
            "../supabase/rollback/ao_intelligence_foundation.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect((await db.query("select * from beatdowns")).rows).toEqual([
        { id: "owned-plan" },
      ]);
      expect((await db.query("select * from fe_profiles")).rows).toEqual([
        { user_id: "existing-profile" },
      ]);
      expect((await db.query("select * from workouts")).rows).toEqual([
        { id: "saved-catalog" },
      ]);
      await db.exec(await readFile(migration, "utf8"));
      await db.exec(importSQL(catalog));
      expect((await db.query("select id from ao_sites")).rows).toHaveLength(16);
    } finally {
      await db.close();
    }
  }, 30000);
  it("detects conflicting duplicate inventory records", async () => {
    const load = async (name: string) =>
      JSON.parse(
        await readFile(
          new URL(
            "../data/ao-intelligence/sheet-" + name + ".json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    const directory = await load("ao-directory");
    const duplicate = [...directory.values[4]];
    duplicate[10] = "Conflicting older planning convention";
    directory.values.push(duplicate);
    const result = buildCatalog({
      directory,
      amenities: await load("amenities"),
      landmarks: await load("landmarks"),
    });
    expect(result.issues.some((i) => i.kind === "duplicate_conflict")).toBe(
      true,
    );
    expect(
      result.catalog.ao_sites.find((a) => a.name === "South Stride")
        ?.planning_mode,
    ).not.toBe(duplicate[10]);
  });
  it("rejects malformed inventory rather than creating guessed AOs", () => {
    expect(() =>
      buildCatalog({
        directory: {
          sourceUrl: "test",
          capturedOn: "2026-10-25",
          values: [["AO"], ["Unrecognized AO"]],
        },
        amenities: { sourceUrl: "", capturedOn: "", values: [] },
        landmarks: { sourceUrl: "", capturedOn: "", values: [] },
      }),
    ).toThrow(/Unmatched AO/);
  });
});
