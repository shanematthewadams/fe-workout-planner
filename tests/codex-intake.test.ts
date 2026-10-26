import { it, expect, vi } from "vitest";
import {
  collectCodex,
  indexCodex,
  CODEX_URL,
} from "../scripts/codex-intake.ts";
const raw = () => [
  {
    id: "upstream-1",
    name: "Example movement",
    type: "exicon",
    description: "<p>Source-owned instructions, never persisted.</p>",
    aliases: [{ name: "Example alias" }],
    tags: [{ id: "tag", name: "Routine" }],
    videoLink: null,
    mentionedEntries: [],
  },
];
it("records only stable IDs/fingerprints and never turns public API access or content approval into publication permission", () => {
  const result = indexCodex(raw());
  expect(result.report.count).toBe(1);
  expect(result.report.publication).toBe("blocked-unresolved-permission");
  expect(JSON.stringify(result)).not.toContain("Source-owned instructions");
  expect(JSON.stringify(result.index)).not.toContain("Example movement");
  const id = result.index.entries[0];
  const again = indexCodex(raw(), result.index, {
    [id.id]: { fingerprint: id.fingerprint, state: "approved" },
  });
  expect(again.report.changes).toEqual([]);
  expect(again.decisions[id.id].state).toBe("approved");
  expect(again.report.sqlGenerated).toBe(false);
});
it("invalidates changed approvals, detects removals/restorations, and rejects duplicates and suspicious partial feeds", () => {
  const first = indexCodex(raw());
  const r = raw();
  r[0].description = "Changed text";
  const changed = indexCodex(r, first.index, {
    ["upstream-1"]: {
      fingerprint: first.index.entries[0].fingerprint,
      state: "approved",
    },
  });
  expect(changed.report.changes[0].kind).toBe("changed");
  expect(changed.decisions["upstream-1"].state).toBe("pending");
  expect(() => indexCodex([...raw(), ...raw()])).toThrow(/Duplicate/);
  const two = indexCodex([...raw(), { ...raw()[0], id: "upstream-2" }]);
  expect(() => indexCodex(raw(), two.index)).toThrow(/incomplete/);
  const removed = indexCodex(raw(), two.index, {}, new Date(), true);
  expect(removed.report.changes).toContainEqual(
    expect.objectContaining({ id: "upstream-2", kind: "removed" }),
  );
  const restored = indexCodex(
    [...raw(), { ...raw()[0], id: "upstream-2" }],
    removed.index,
  );
  expect(restored.report.changes[0].kind).toBe("restored");
});
it("caches successful checks for a day, uses one explicit refresh request, and fails without changing a prior index", async () => {
  const at = new Date("2026-10-26T00:00:00Z"),
    previous = indexCodex(raw(), undefined, {}, at).index;
  const f = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(raw())));
  expect(
    (
      await collectCodex(
        previous,
        {},
        { now: new Date(at.getTime() + 1000), fetcher: f },
      )
    ).cached,
  ).toBe(true);
  expect(f).not.toHaveBeenCalled();
  await collectCodex(previous, {}, { refresh: true, now: at, fetcher: f });
  expect(f).toHaveBeenCalledTimes(1);
  expect(f.mock.calls[0][0]).toBe(CODEX_URL);
  f.mockRejectedValue(Error("offline"));
  const before = JSON.stringify(previous);
  await expect(
    collectCodex(previous, {}, { refresh: true, fetcher: f }),
  ).rejects.toThrow("offline");
  expect(JSON.stringify(previous)).toBe(before);
});
it("rejects malformed or wrong-type source records and does not interpret nested descriptions as movements", () => {
  expect(() => indexCodex([{ ...raw()[0], type: "lexicon" }])).toThrow();
  expect(() => indexCodex([{ ...raw()[0], id: "" }])).toThrow();
  const nested = indexCodex([
    {
      ...raw()[0],
      resolvedMentionsData: { x: { description: "untrusted instruction" } },
    },
  ]);
  expect(nested.index.entries).toHaveLength(1);
  expect(JSON.stringify(nested)).not.toContain("untrusted instruction");
});
