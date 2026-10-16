import { z } from "zod";
import { workoutSchema, type Workout } from "../model";
const studioExercise = z.object({
  id: z.string(),
  name: z.string(),
  f3Name: z.string(),
  cadence: z.enum(["IC", "OYO", "Timed"]),
  repsOrDuration: z.string(),
  notes: z.string().optional(),
  cadenceCallout: z.string().optional(),
});
const studioSection = z.object({
  title: z.string(),
  durationMinutes: z.number().min(0).max(120),
  description: z.string(),
  exercises: z.array(studioExercise).max(100),
  instructions: z.array(z.string()).optional(),
});
const studioWorkout = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(160),
  aoName: z.string().max(160).optional(),
  qName: z.string().max(160),
  theme: z.string(),
  equipment: z.array(z.string()),
  workoutStyle: z.string(),
  disclaimer: z.string(),
  sections: z.object({
    warmup: studioSection,
    theThang: studioSection,
    mary: studioSection,
    cot: studioSection,
  }),
  qNotes: z.array(z.string()).optional(),
  isAiGenerated: z.boolean(),
});
export function importStudio(value: unknown): Workout {
  const w = studioWorkout.parse(value),
    id = "studio-" + crypto.randomUUID();
  return workoutSchema.parse({
    schemaVersion: 1,
    id,
    originId: w.id,
    title: w.title,
    summary: w.theme,
    kind: "personal",
    duration: 45,
    equipment: w.equipment
      .filter((e) => e !== "none")
      .map((e) => (e === "cindy-coupons" ? "Coupon" : e)),
    running: "None",
    format: "Custom",
    sections: (
      [
        ["warmup", w.sections.warmup],
        ["thang", w.sections.theThang],
        ["mary", w.sections.mary],
      ] as const
    )
      .filter(([kind, s]) => kind === "thang" || s.durationMinutes > 0)
      .map(([kind, s], si) => ({
        id: `s${si}`,
        kind,
        title: s.title,
        blocks: [
          {
            id: `b${si}`,
            title: s.title,
            minutes: s.durationMinutes,
            instructions: [s.description, ...(s.instructions ?? [])].join("\n"),
            exercises: s.exercises.map((e, ei) => ({
              id: `e${si}-${ei}`,
              name: e.f3Name || e.name,
              amount: e.repsOrDuration,
              unit: "instructions",
              counting:
                e.cadence === "IC"
                  ? "cadence"
                  : e.cadence === "Timed"
                    ? "time"
                    : "not applicable",
              instructions: [e.notes, e.cadenceCallout]
                .filter(Boolean)
                .join("\n"),
            })),
          },
        ],
      })),
    rawNotes: JSON.stringify(value, null, 2),
    adaptationNotes: [
      ...(w.qNotes ?? []),
      "Imported from AI Studio; original timing and counts retained. Review timing, equipment and running requirements.",
      `Original disclaimer: ${w.disclaimer}`,
      `Post-workout COT: ${w.sections.cot.description}`,
      ...(w.sections.cot.instructions ?? []),
    ].join("\n"),
    provenance: {
      status: "personal",
      label: "Imported Studio draft · not a reviewed regional original",
      ao: w.aoName,
      q: w.qName,
      issues: [
        "Running requirement unknown; confirm from original Studio instructions",
        "Studio timing may differ from the standard schedule",
      ],
      durationBasis: "inferred",
    },
    updatedAt: new Date().toISOString(),
  });
}
