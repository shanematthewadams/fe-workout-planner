import { z } from "zod";
const text = z.string().max(20000);
export const exerciseSchema = z.object({
  id: z.string().min(1).max(100),
  name: text,
  amount: text,
  unit: z.enum([
    "reps",
    "seconds",
    "minutes",
    "meters",
    "rounds",
    "instructions",
  ]),
  sets: z.number().int().min(1).max(100).optional(),
  counting: z.enum([
    "total",
    "1=1",
    "2=1",
    "per side",
    "cadence",
    "time",
    "distance",
    "not applicable",
  ]),
  instructions: text,
});
export const blockSchema = z.object({
  id: z.string().min(1).max(100),
  title: text,
  instructions: text,
  minutes: z.number().min(0).max(300).nullable(),
  exercises: z.array(exerciseSchema).max(100),
});
export const sectionSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.enum(["warmup", "thang", "mary"]),
  title: text,
  blocks: z.array(blockSchema).min(1).max(50),
});
export const workoutSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(100),
    originId: z.string().max(100).optional(),
    title: z.string().trim().min(1).max(160),
    summary: text,
    kind: z.enum(["source", "personal"]),
    duration: z.number().min(1).max(300).nullable(),
    equipment: z.array(z.string().max(100)).max(20),
    running: z.enum(["None", "Light", "Moderate"]),
    format: z.enum([
      "Circuit",
      "11s",
      "EMOM",
      "AMRAP",
      "Ladder",
      "Partner",
      "Stations",
      "Chipper",
      "Custom",
    ]),
    sections: z.array(sectionSchema).min(1).max(3),
    rawNotes: text,
    adaptationNotes: text,
    provenance: z.object({
      status: z.enum([
        "illustrative",
        "personal",
        "imported-unreviewed",
        "regional-reviewed",
      ]),
      label: text,
      sourceId: z.string().max(100).optional(),
      q: z.string().max(160).optional(),
      ao: z.string().max(160).optional(),
      eventDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      checkedAt: z.string().datetime().optional(),
      issues: z.array(z.string().max(500)).max(30).optional(),
      durationBasis: z.enum(["source", "inferred", "unknown"]).optional(),
      url: z
        .string()
        .url()
        .max(2000)
        .refine(
          (value) => /^https?:\/\//i.test(value),
          "Source links must use http or https.",
        )
        .optional(),
    }),
    updatedAt: z.string().datetime(),
  })
  .superRefine((w, ctx) => {
    const kinds = w.sections.map((s) => s.kind);
    if (!kinds.includes("thang") || new Set(kinds).size !== kinds.length)
      ctx.addIssue({
        code: "custom",
        message: "Include exactly one The Thang; section types cannot repeat.",
      });
    const ids = w.sections.flatMap((s) => [
      s.id,
      ...s.blocks.flatMap((b) => [b.id, ...b.exercises.map((e) => e.id)]),
    ]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Section, block, and exercise IDs must be unique.",
      });
  });
export type Workout = z.infer<typeof workoutSchema>;
export type Section = Workout["sections"][number];
export type Exercise = z.infer<typeof exerciseSchema>;
export const uid = () => crypto.randomUUID();
export const newExercise = (): Exercise => ({
  id: uid(),
  name: "New exercise",
  amount: "10",
  unit: "reps",
  counting: "total",
  instructions: "",
});
export function newSection(kind: Section["kind"]): Section {
  return {
    id: uid(),
    kind,
    title: kind === "thang" ? "The Thang" : kind === "mary" ? "Mary" : "Warmup",
    blocks: [
      {
        id: uid(),
        title: "The plan",
        instructions: "",
        minutes: null,
        exercises: [],
      },
    ],
  };
}
export function newWorkout(): Workout {
  return {
    schemaVersion: 1,
    id: uid(),
    title: "My next beatdown",
    summary: "",
    kind: "personal",
    duration: null,
    equipment: [],
    running: "None",
    format: "Custom",
    sections: [newSection("warmup"), newSection("thang")],
    rawNotes: "",
    adaptationNotes: "",
    provenance: {
      status: "personal",
      label: "Personal draft · stored on this device",
    },
    updatedAt: new Date().toISOString(),
  };
}
export function titledCopy(title: string, suffix: string) {
  return title.slice(0, 160 - suffix.length) + suffix;
}
export function copyWorkout(w: Workout): Workout {
  return {
    ...structuredClone(w),
    id: uid(),
    originId: w.originId ?? w.id,
    title: titledCopy(w.title, " · my copy"),
    kind: "personal",
    updatedAt: new Date().toISOString(),
  };
}
export const filtersEmpty = {
  query: "",
  duration: "All",
  equipment: "All",
  running: "All",
  format: "All",
  status: "All",
  ao: "All",
};
export type Filters = typeof filtersEmpty;
export function aoKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function matches(w: Workout, f: Filters) {
  return (
    (!f.query ||
      `${w.title} ${w.summary} ${w.provenance.q ?? ""} ${w.provenance.ao ?? ""} ${w.sections.flatMap((s) => s.blocks.flatMap((b) => [b.instructions, ...b.exercises.map((e) => e.name)])).join(" ")}`
        .toLowerCase()
        .includes(f.query.trim().toLowerCase())) &&
    (f.duration === "All" ||
      (w.duration !== null &&
        (f.duration === "30 or less"
          ? w.duration <= 30
          : f.duration === "31–45"
            ? w.duration > 30 && w.duration <= 45
            : w.duration > 45))) &&
    (f.equipment === "All" ||
      (f.equipment === "None"
        ? w.equipment.length === 0 &&
          !w.provenance.issues?.some((i) =>
            i.startsWith("Equipment not specified"),
          )
        : w.equipment.includes(f.equipment))) &&
    (f.running === "All" ||
      (w.running === f.running &&
        !w.provenance.issues?.some((i) =>
          i.startsWith("Running requirement not supplied"),
        ))) &&
    (f.format === "All" || w.format === f.format) &&
    (f.status === "All" ||
      (w.kind === "personal" ? "personal" : w.provenance.status) ===
        f.status) &&
    (f.ao === "All" ||
      (!!w.provenance.ao && aoKey(w.provenance.ao) === aoKey(f.ao)))
  );
}
export function timing(w: Workout) {
  const blocks = w.sections.flatMap((s) => s.blocks);
  return blocks.some((b) => b.minutes === null)
    ? null
    : blocks.reduce((n, b) => n + (b.minutes ?? 0), 0);
}
const backupSchema = z.object({
  format: z.literal("fe-workout-backup"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  workouts: z
    .array(
      workoutSchema.refine(
        (w) => w.kind === "personal",
        "Backups contain personal workouts only",
      ),
    )
    .max(200),
  favorites: z.array(z.string().min(1).max(100)).max(500),
});
export type Backup = z.infer<typeof backupSchema>;
export function parseBackup(input: string): Backup {
  if (
    input.length > 5_000_000 ||
    new TextEncoder().encode(input).byteLength > 5_000_000
  )
    throw Error("Backup exceeds 5 MB.");
  const parsed = backupSchema.parse(JSON.parse(input));
  if (new Set(parsed.workouts.map((w) => w.id)).size !== parsed.workouts.length)
    throw Error("Duplicate workout IDs in backup.");
  return parsed;
}
export function mergeBackup(
  existing: Workout[],
  incoming: Workout[],
  reservedIds: string[] = [],
) {
  const result = [...existing];
  let conflicts = 0;
  for (const w of incoming) {
    if (reservedIds.includes(w.id) || result.some((x) => x.id === w.id)) {
      result.push({
        ...structuredClone(w),
        id: uid(),
        title: titledCopy(w.title, " · imported copy"),
      });
      conflicts++;
    } else result.push(structuredClone(w));
  }
  return { workouts: result, conflicts };
}
export const STORAGE_KEY = "fe-planner:v1";
export type LocalState = { workouts: Workout[]; favorites: string[] };
export function writeState(
  state: LocalState,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  const backup = {
    format: "fe-workout-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    ...state,
  };
  parseBackup(JSON.stringify(backup));
  storage.setItem(STORAGE_KEY, JSON.stringify(backup));
}
export function readState(
  storage: Pick<Storage, "getItem"> = localStorage,
): LocalState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { workouts: [], favorites: [] };
  return parseBackup(raw);
}
