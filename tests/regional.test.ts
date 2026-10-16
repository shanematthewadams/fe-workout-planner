import { describe, expect, it } from "vitest";
import reviewed from "../data/regional-review.json";
import exported from "../data/regional-workouts.json";
import {
  publishedWorkouts,
  mergeSources,
  type RecordEntry,
} from "../scripts/catalog-import";
import { catalog } from "../src/catalog";
import {
  copyWorkout,
  filtersEmpty,
  matches,
  workoutSchema,
} from "../src/model";
const entries = reviewed as RecordEntry[];
describe("reviewed FE collection", () => {
  it("reproduces all published instructions and approval metadata from the durable review registry", () => {
    expect(entries).toHaveLength(25);
    expect(publishedWorkouts(entries)).toEqual(exported);
    expect(new Set(exported.map((w) => w.id)).size).toBe(25);
    for (const w of exported)
      expect(workoutSchema.safeParse(w).success).toBe(true);
    expect(catalog).toHaveLength(35);
  });
  it("preserves approval on identical real-source reimport and invalidates changed instructions", () => {
    expect(
      mergeSources(
        entries,
        entries.map((r) => r.source),
      ),
    ).toEqual(entries);
    const changed = structuredClone(entries[0].source);
    changed.sections[0].text += "\nChanged upstream";
    const next = mergeSources(entries, [changed]);
    expect(publishedWorkouts(next)).toHaveLength(24);
    expect(
      next.find((r) => r.sourceId === changed.sourceId)?.reviewedHash,
    ).toBeUndefined();
  });
  it("searches source-text exercise names and does not call unknown requirements none", () => {
    const w = catalog.find((w) => w.id === "f3nation:event:473565")!;
    expect(matches(w, { ...filtersEmpty, query: "walking lunges" })).toBe(true);
    expect(matches(w, { ...filtersEmpty, running: "None" })).toBe(false);
    expect(matches(w, { ...filtersEmpty, equipment: "None" })).toBe(false);
  });
  it("links official AO labels to punctuation and spacing variants without changing source metadata", () => {
    expect(
      catalog.filter((w) => matches(w, { ...filtersEmpty, ao: "South Park" })),
    ).toHaveLength(3);
    expect(
      catalog.filter((w) =>
        matches(w, { ...filtersEmpty, ao: "Yippee Ki Yay" }),
      ),
    ).toHaveLength(1);
  });
  it("keeps personal copies independent of real-source refreshes", () => {
    const w = catalog.find((w) => w.id === entries[0].sourceId)!;
    const original = JSON.stringify(w),
      copy = copyWorkout(w);
    copy.sections[0].blocks[0].instructions = "My private adaptation";
    expect(copy.id).not.toBe(w.id);
    expect(copy.originId).toBe(w.id);
    expect(JSON.stringify(w)).toBe(original);
    expect(publishedWorkouts(mergeSources(entries, []))).toEqual(exported);
  });
});
