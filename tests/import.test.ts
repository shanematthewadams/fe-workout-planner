import { describe, it, expect, vi } from "vitest";
import {
  sourceSchema,
  mergeSources,
  fingerprint,
  approve,
  publishedWorkouts,
  extractSections,
  sourceIssues,
} from "../scripts/catalog-import";
import { fetchNation } from "../scripts/nation-adapter";
import { copyWorkout } from "../src/model";
// Entirely synthetic fixtures, never presented as real FE workouts.
const source = () =>
  sourceSchema.parse({
    sourceId: "fixture:1",
    title: "Synthetic ladder",
    url: "https://example.com/1",
    sections: [
      {
        kind: "thang",
        text: "2 blockees, 4 WW3s, 6 Derkins; 3 down and back. Lunges 1=1. Hammers 2=1.",
      },
    ],
    privacyReviewed: true,
    reuse: { basis: "permission", evidence: "Synthetic test fixture only" },
  });
describe("reviewed import", () => {
  it("is idempotent and preserves exact order, counts and counting text", () => {
    const s = source(),
      first = mergeSources([], [s]),
      approved = approve(first[0], fingerprint(s), "Fixture reviewer");
    const twice = mergeSources([approved], [s]);
    expect(twice).toEqual([approved]);
    const w = publishedWorkouts(twice)[0];
    expect(w.id).toBe(s.sourceId);
    expect(w.sections[0].blocks[0].instructions).toBe(s.sections[0].text);
    expect(w.rawNotes).toBe("");
    expect(w.duration).toBeNull();
    expect(w.sections.map((s) => s.kind)).toEqual(["thang"]);
    expect(sourceIssues(s)).toContain("Warmup not supplied");
  });
  it("changed source invalidates review without touching a personal copy", () => {
    const s = source(),
      entry = approve(
        mergeSources([], [s])[0],
        fingerprint(s),
        "Fixture reviewer",
      );
    const personal = copyWorkout(publishedWorkouts([entry])[0]);
    const saved = structuredClone(personal);
    const changed = mergeSources([entry], [{ ...s, title: "Changed source" }]);
    expect(publishedWorkouts(changed)).toEqual([]);
    expect(changed[0].sourceId).toBe(entry.sourceId);
    expect(personal).toEqual(saved);
    expect(() => approve(changed[0], entry.fingerprint, "reviewer")).toThrow(
      "stale",
    );
  });
  it("archives explicitly, never deletes missing records, blocks unresolved reuse and sparse/malformed records", () => {
    const s = source(),
      entry = approve(
        mergeSources([], [s])[0],
        fingerprint(s),
        "Fixture reviewer",
      );
    expect(mergeSources([entry], [])).toEqual([entry]);
    expect(
      publishedWorkouts(mergeSources([entry], [{ ...s, archived: true }])),
    ).toEqual([]);
    for (const candidate of [
      { ...s, sections: [] },
      { ...s, reuse: { basis: "unresolved" as const, evidence: "" } },
      { ...s, archived: true },
    ])
      expect(() =>
        approve(mergeSources([], [candidate])[0], fingerprint(candidate), "r"),
      ).toThrow();
    expect(() => mergeSources([], [s, s])).toThrow("Duplicate");
    expect(() =>
      sourceSchema.parse({ ...s, rawBackblast: "private" }),
    ).toThrow();
    expect(() =>
      sourceSchema.parse({ ...s, url: "javascript:alert(1)" }),
    ).toThrow();
  });
  it("extracts known sections only and drops unrelated personal sections", () => {
    const extracted = extractSections(
      "Unrelated intro\nWarm-a-rama:\nSSH x 10 IC\nThe Thang:\n10 merkins\nMary:\nNot time for her\nCOT:\nPrivate prayer\nAnnouncements:\nContact someone",
    );
    expect(extracted).toEqual([
      { kind: "warmup", text: "SSH x 10 IC" },
      { kind: "thang", text: "10 merkins" },
      { kind: "mary", text: "Not time for her" },
    ]);
    expect(extractSections("unstructured narrative")).toEqual([]);
  });
});
describe("F3 Nation read-only adapter (contract fixtures, not live narratives)", () => {
  const event = (id: number) => ({
    id,
    name: "Synthetic",
    isPrivate: false,
    isActive: true,
    startDate: "2026-10-01",
    org: { id: 2, name: "Test AO", parentId: 1 },
    backblast: "The Thang\n10 merkins",
  });
  const run = (fetcher: typeof fetch) =>
    fetchNation({
      token: "fixture-token",
      regionId: 1,
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      fetcher,
    });
  it("uses documented 100-row pages and detail routes; excludes private/inactive and metadata-only records", async () => {
    const calls: string[] = [];
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url.toString());
      expect(init?.headers).toMatchObject({ client: "fe-workout-planner" });
      expect(init?.method).toBeUndefined();
      if (url.pathname.endsWith("/event-instance")) {
        const n = Number(url.searchParams.get("pageIndex"));
        expect(url.searchParams.get("pageSize")).toBe("100");
        return Response.json({
          eventInstances:
            n === 0
              ? Array.from({ length: 100 }, (_, i) => ({
                  ...event(i + 1),
                  isPrivate: i < 98,
                }))
              : [event(101)],
          totalCount: 101,
        });
      }
      const id = Number(url.pathname.split("/").at(-1));
      return Response.json({
        ...event(id),
        backblast: id === 100 ? null : event(id).backblast,
      });
    });
    expect((await run(f)).map((r) => r.id)).toEqual([99, 101]);
    expect(calls.some((c) => c.includes("/id/101"))).toBe(true);
    expect(calls).toHaveLength(5);
  });
  it("fails closed on auth, upstream outage, malformed data, repeated pages and wrong region", async () => {
    for (const response of [
      new Response("", { status: 401 }),
      new Response("", { status: 503 }),
      Response.json({ events: [] }),
      Response.json({ eventInstances: [event(1)], totalCount: 200 }),
    ])
      await expect(run(vi.fn().mockResolvedValue(response))).rejects.toThrow();
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ eventInstances: [event(1)], totalCount: 1 }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ...event(1),
          org: { id: 2, name: "Wrong", parentId: 3 },
        }),
      );
    await expect(run(f)).rejects.toThrow("region");
  });
  it("rejects repeated final pages instead of silently calling the import complete", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...event(i + 1),
      isPrivate: true,
    }));
    const f = vi.fn(async () =>
      Response.json({ eventInstances: rows, totalCount: 200 }),
    );
    await expect(run(f)).rejects.toThrow("repeated");
    expect(f).toHaveBeenCalledTimes(2);
  });
});
