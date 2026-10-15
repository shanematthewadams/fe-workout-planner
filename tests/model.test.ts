import { describe, it, expect } from "vitest";
import { catalog } from "../src/catalog";
import {
  workoutSchema,
  copyWorkout,
  parseBackup,
  mergeBackup,
  matches,
  filtersEmpty,
  timing,
  writeState,
  readState,
  newWorkout,
} from "../src/model";
const backup = (workouts = [copyWorkout(catalog[0])]) =>
  JSON.stringify({
    format: "fe-workout-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts,
    favorites: [catalog[0].id],
  });
describe("catalog and timing", () => {
  it("provides ten valid, distinct, honest templates", () => {
    expect(catalog).toHaveLength(10);
    expect(new Set(catalog.map((w) => w.id)).size).toBe(10);
    for (const w of catalog) {
      expect(workoutSchema.safeParse(w).success).toBe(true);
      expect(w.kind).toBe("source");
      expect(w.provenance.status).toBe("illustrative");
      expect(
        w.sections
          .flatMap((s) => s.blocks)
          .every((b) => b.instructions.length > 30),
      ).toBe(true);
    }
  });
  it("permits missing Mary and explains remaining time", () => {
    const w = catalog[8];
    expect(w.sections.some((s) => s.kind === "mary")).toBe(false);
    expect(timing(w)).toBe(40);
    expect(w.adaptationNotes).toContain("5 minutes");
  });
  it("does not invent unknown timing", () => {
    const w = newWorkout();
    expect(timing(w)).toBeNull();
    expect(w.duration).toBeNull();
  });
  it("declares counts for every exercise including paired movement", () => {
    const xs = catalog.flatMap((w) =>
      w.sections.flatMap((s) => s.blocks.flatMap((b) => b.exercises)),
    );
    expect(xs.every((x) => x.counting && x.instructions && x.amount)).toBe(
      true,
    );
    expect(xs.some((x) => x.counting === "2=1")).toBe(true);
    expect(xs.some((x) => x.counting === "per side")).toBe(true);
  });
});
describe("copy and local persistence", () => {
  it("deep copies without touching source IDs or content", () => {
    const original = JSON.stringify(catalog[0]);
    const copy = copyWorkout(catalog[0]);
    copy.sections[0].blocks[0].exercises[0].amount = "999";
    expect(JSON.stringify(catalog[0])).toBe(original);
    expect(copy.originId).toBe(catalog[0].id);
    expect(copy.id).not.toBe(catalog[0].id);
    expect(copy.kind).toBe("personal");
  });
  it("survives a storage reload with favorites and raw notes", () => {
    let raw = "";
    const storage = {
      setItem: (_k: string, v: string) => {
        raw = v;
      },
      getItem: () => raw,
    };
    const w = copyWorkout(catalog[0]);
    w.rawNotes = "  exact\n\nraw notes  ";
    writeState({ workouts: [w], favorites: [catalog[0].id] }, storage);
    expect(readState(storage)).toMatchObject({
      workouts: [w],
      favorites: [catalog[0].id],
    });
  });
  it("surfaces write failure and never pretends persistence succeeded", () => {
    expect(() =>
      writeState(
        { workouts: [], favorites: [] },
        {
          setItem: () => {
            throw Error("quota");
          },
        },
      ),
    ).toThrow("quota");
  });
  it("surfaces malformed saved data for recovery", () => {
    expect(() => readState({ getItem: () => "{bad" })).toThrow();
  });
});
describe("backup validation and conflicts", () => {
  it("accepts valid versioned backups", () =>
    expect(parseBackup(backup()).version).toBe(1));
  it.each([
    "{}",
    "not json",
    backup().replace('"version":1', '"version":2'),
    backup([catalog[0]]),
    backup().replace('"minutes":5', '"minutes":-5'),
  ])("rejects invalid input", (raw) =>
    expect(() => parseBackup(raw)).toThrow(),
  );
  it("rejects oversized data and duplicate IDs", () => {
    expect(() => parseBackup(" ".repeat(5_000_001))).toThrow();
    const w = copyWorkout(catalog[0]);
    expect(() => parseBackup(backup([w, w]))).toThrow();
  });
  it("retains existing drafts and makes conflicts new copies", () => {
    const w = copyWorkout(catalog[0]);
    const modified = structuredClone(w);
    modified.title = "Changed";
    const m = mergeBackup([w], [modified]);
    expect(m.conflicts).toBe(1);
    expect(m.workouts[0]).toEqual(w);
    expect(m.workouts[1].id).not.toBe(w.id);
    expect(m.workouts[1].title).toBe("Changed · imported copy");
  });
  it("rejects duplicate sections and missing The Thang", () => {
    const w = newWorkout();
    w.sections = [w.sections[0]];
    expect(workoutSchema.safeParse(w).success).toBe(false);
    w.sections.push(w.sections[0]);
    expect(workoutSchema.safeParse(w).success).toBe(false);
  });
});
describe("reserved catalog IDs", () => {
  it("remaps imported draft IDs that collide with source IDs", () => {
    const w = copyWorkout(catalog[0]);
    w.id = catalog[0].id;
    const merged = mergeBackup(
      [],
      [w],
      catalog.map((x) => x.id),
    );
    expect(merged.conflicts).toBe(1);
    expect(merged.workouts[0].id).not.toBe(w.id);
  });
});
describe("filters", () => {
  it("combines all filters with AND semantics", () => {
    const f = {
      ...filtersEmpty,
      equipment: "Coupon",
      running: "None",
      format: "Circuit",
      duration: "31–45",
    };
    expect(catalog.filter((w) => matches(w, f)).map((w) => w.id)).toEqual([
      "fe-template-coupon",
    ]);
    expect(
      catalog.filter((w) => matches(w, { ...f, query: "no match" })),
    ).toEqual([]);
  });
  it("resets to all and excludes unknown durations when filtered", () => {
    expect(catalog.filter((w) => matches(w, filtersEmpty))).toHaveLength(10);
    expect(
      matches(newWorkout(), { ...filtersEmpty, duration: "30 or less" }),
    ).toBe(false);
  });
});

describe("copy and backup boundary cases", () => {
  it("keeps maximum-length titles valid when copying or importing conflicts", () => {
    const original = { ...catalog[0], title: "A".repeat(160) };
    const copy = copyWorkout(original);
    expect(copy.title).toHaveLength(160);
    expect(workoutSchema.safeParse(copy).success).toBe(true);
    copy.title = "B".repeat(160);
    const imported = mergeBackup([copy], [copy]).workouts[1];
    expect(imported.title).toHaveLength(160);
    expect(workoutSchema.safeParse(imported).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "invalid"])(
    "rejects unsafe source link %s without throwing inside safeParse",
    (url) => {
      const workout = {
        ...catalog[0],
        provenance: { ...catalog[0].provenance, url },
      };
      expect(workoutSchema.safeParse(workout).success).toBe(false);
    },
  );
  it("uses UTF-8 byte size for the backup limit", () => {
    expect(() => parseBackup("😀".repeat(1_300_000))).toThrow(
      "Backup exceeds 5 MB.",
    );
  });
});
