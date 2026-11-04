import { it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import decision from "../data/codex-reuse-decision.json";
import {
  codexPlainText,
  prepareCodexReference,
  codexReferenceSQL,
} from "../scripts/codex-reference.ts";
import {
  codexReferenceSchema,
  searchCodex,
  codexEntryURL,
} from "../src/codex-reference.ts";
import {
  createCodexReader,
  handleCodexReference,
} from "../server/codex-reference.ts";
const at = "2026-11-04T01:00:00Z";
const raw = () =>
  Array.from({ length: 12 }, (_, i) => ({
    id: "official-" + i,
    name: i < 2 ? "Same name" : "Example " + i,
    type: "exicon",
    description:
      "<p>First &amp; second.</p><ul><li>Stand.</li><li>Lower.</li></ul>",
    aliases: [{ name: "Alias " + i }],
    tags: [{ id: "t1", name: "Routine" }],
    mentionedEntries: i === 0 ? ["missing-target"] : [],
  }));
const prepared = () => prepareCodexReference(raw(), decision, at);
it("sanitizes source HTML to inert plain text, preserves structure and rejects conflicting/duplicate source identities", () => {
  expect(
    codexPlainText(
      "<p>A &amp; B</p><script>steal()</script><svg><text>bad</text></svg><p>C<br>D<img src=x onerror=bad()></p>",
    ),
  ).toBe("A & B\n\nC\nD");
  expect(codexPlainText("&lt;img src=x onerror=bad()&gt;")).toBe(
    "<img src=x onerror=bad()>",
  ); // text, never innerHTML
  const p = prepared();
  expect(p.report.duplicateNames).toHaveLength(1);
  expect(p.report.missingMentions).toEqual([
    { entry_id: "official-0", target_id: "missing-target" },
  ]);
  expect(() => prepareCodexReference([...raw(), raw()[0]], decision)).toThrow(
    /Duplicate/,
  );
  const conflict = raw();
  conflict[1].tags[0].name = "Different";
  expect(() => prepareCodexReference(conflict, decision)).toThrow(
    /Conflicting tag/,
  );
  expect(() =>
    prepareCodexReference(
      [{ ...raw()[0], description: "<script>only script</script>" }],
      decision,
    ),
  ).toThrow(/Empty usable/);
  expect(() =>
    prepareCodexReference(raw(), { ...decision, basis: "upstream-license" }),
  ).toThrow();
  expect(p.report.automaticPlanningClassification).toBe(false);
  expect(codexEntryURL("a&b")).toContain("entryId=a%26b");
});
it("imports twice safely, retains overrides and older data, reconciles removals, enforces full RLS chains and rolls back without touching existing tables", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;",
    );
    for (const f of [
      "20261025175228_ao_intelligence_foundation.sql",
      "20261104153007_codex_reference_catalog.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + f, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "create table compatibility_marker(id text primary key);insert into compatibility_marker values('saved-workout-profile');",
    );
    await db.exec(codexReferenceSQL(prepared()));
    const snapshot = async () =>
      JSON.stringify(
        (await db.query("select * from ex_codex_entries order by id")).rows,
      );
    const before = await snapshot();
    const repeated = await db.exec(codexReferenceSQL(prepared()));
    expect(JSON.stringify(repeated)).toContain('"changed":0');
    expect(await snapshot()).toBe(before);
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      const r = (
        await db.query<{ data: unknown }>("select fe_codex_reference() data")
      ).rows[0].data;
      const c = codexReferenceSchema.parse(r);
      expect(c.entries).toHaveLength(12);
      expect(c.entries[0].aliases).toHaveLength(1);
      expect(searchCodex(c, "alias 2", "Routine")).toHaveLength(1);
      for (const table of [
        "reuse",
        "entries",
        "aliases",
        "tags",
        "entry_tags",
        "mentions",
      ]) {
        for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
          expect(
            (
              await db.query<{ ok: boolean }>(
                `select has_table_privilege(current_user,'public.ex_codex_${table}','${privilege}') ok`,
              )
            ).rows[0].ok,
          ).toBe(false);
      }
      await expect(
        db.exec("update ex_codex_reuse set enabled=false"),
      ).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    // Same-name records keep separate official identities; tags do not create planner movements.
    expect(
      (
        await db.query(
          "select count(*)::int n from ex_codex_entries where name='Same name'",
        )
      ).rows,
    ).toEqual([{ n: 2 }]);
    await db.exec(
      "update ex_codex_entries set protected=true where id='official-0';",
    );
    const changed = raw();
    changed[0].description = "Changed source";
    changed[1].description = "New text";
    const update = await db.exec(
      codexReferenceSQL(
        prepareCodexReference(changed, decision, "2026-11-05T01:00:00Z"),
      ),
    );
    expect(JSON.stringify(update)).toContain(
      "protected, older or conflicting source retained",
    );
    expect(
      (
        await db.query(
          "select description from ex_codex_entries where id='official-1'",
        )
      ).rows,
    ).toEqual([{ description: "New text" }]);
    await expect(db.exec(codexReferenceSQL(prepared()))).rejects.toThrow(
      /Existing operator decision/,
    );
    await db.exec("rollback");
    await expect(
      db.exec(
        codexReferenceSQL(
          prepareCodexReference(
            raw().slice(0, 3),
            decision,
            "2026-11-06T01:00:00Z",
          ),
        ),
      ),
    ).rejects.toThrow(/incomplete/);
    await db.exec("rollback");
    const removed = raw().filter((e) => e.id !== "official-11");
    await db.exec(
      codexReferenceSQL(
        prepareCodexReference(removed, decision, "2026-11-06T01:00:00Z"),
      ),
    );
    await db.exec("set role anon");
    expect(
      codexReferenceSchema.parse(
        (await db.query<{ data: unknown }>("select fe_codex_reference() data"))
          .rows[0].data,
      ).entries,
    ).toHaveLength(11);
    await db.exec("reset role");
    await db.exec("update ex_codex_reuse set enabled=false;set role anon");
    for (const table of [
      "reuse",
      "entries",
      "aliases",
      "tags",
      "entry_tags",
      "mentions",
    ])
      expect(
        (await db.query(`select count(*)::int n from ex_codex_${table}`)).rows,
      ).toEqual([{ n: 0 }]);
    await db.exec("reset role");
    await expect(
      db.exec(
        codexReferenceSQL(
          prepareCodexReference(raw(), decision, "2026-11-07T01:00:00Z"),
        ),
      ),
    ).rejects.toThrow(/Existing operator decision/);
    await db.exec("rollback");
    expect(
      (
        await db.query(
          "select prosecdef from pg_proc where proname='fe_codex_reference'",
        )
      ).rows,
    ).toEqual([{ prosecdef: false }]);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/rollback/codex_reference_catalog.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect((await db.query("select * from compatibility_marker")).rows).toEqual(
      [{ id: "saved-workout-profile" }],
    );
  } finally {
    await db.close();
  }
}, 30000);
const reference = () => ({
  version: 1,
  attribution: "F3 Nation · F3 Codex",
  entries: prepared().entries.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    fingerprint: e.fingerprint,
    captured_at: e.captured_at,
    aliases: e.aliases,
    tags: ["Routine"],
    mentioned_ids: e.mentioned_ids,
  })),
});
it("uses one bounded cached database read, fails closed on bad payloads, never fetches Nation, and returns a clear unavailable result", async () => {
  let now = 0;
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(reference())));
  const read = createCodexReader(fetcher, () => now);
  const env = {
    enabled: "true",
    url: "https://example.supabase.co",
    publishableKey: "sb_publishable_test",
  };
  const values = await Promise.all([read(env), read(env)]);
  expect(values[0]?.entries).toHaveLength(12);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0].toString()).toBe(
    "https://example.supabase.co/rest/v1/rpc/fe_codex_reference",
  );
  const response = await handleCodexReference(
    new Request("https://app.test/api/codex"),
    env,
    read,
  );
  expect((await response.json()).source).toBe("database");
  expect(fetcher).toHaveBeenCalledTimes(1);
  now = 60001;
  fetcher.mockImplementation(async () => new Response("<html>SPA</html>"));
  expect(await read(env)).toBeNull();
  expect(await read(env)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(await read({ ...env, enabled: "false" })).toBeNull();
  expect(await read({ ...env, url: "https://user:pass@db.test" })).toBeNull();
  const off = await handleCodexReference(
    new Request("https://app.test/api/codex"),
  );
  expect(await off.json()).toEqual({
    version: 1,
    source: "unavailable",
    reference: null,
  });
  expect(
    (
      await handleCodexReference(
        new Request("https://app.test/api/codex", { method: "POST" }),
      )
    ).status,
  ).toBe(405);
});
