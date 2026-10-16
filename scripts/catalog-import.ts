import { createHash } from "node:crypto";
import { z } from "zod";
import { workoutSchema, type Workout } from "../src/model.ts";
const sectionSchema = z.object({
  kind: z.enum(["warmup", "thang", "mary"]),
  text: z.string().trim().min(1).max(20000),
});
// Reviewed, workout-only export. This format intentionally has no raw-backblast field.
export const sourceSchema = z
  .object({
    sourceId: z.string().regex(/^[a-z0-9][a-z0-9:._-]{0,99}$/),
    url: z
      .string()
      .url()
      .refine((s) => s.startsWith("https://")),
    title: z.string().trim().min(1).max(160),
    q: z.string().max(160).optional(),
    ao: z.string().max(160).optional(),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    sections: z.array(sectionSchema).max(3),
    duration: z.number().positive().max(300).nullable().default(null),
    durationBasis: z.enum(["source", "inferred", "unknown"]).default("unknown"),
    equipment: z.array(z.string().max(100)).max(20).default([]),
    running: z.enum(["None", "Light", "Moderate"]).optional(),
    issues: z.array(z.string().max(500)).max(20).default([]),
    reuse: z.object({
      basis: z.enum(["permission", "license", "unresolved"]),
      evidence: z.string().max(1000),
    }),
    archived: z.boolean().default(false),
    privacyReviewed: z.boolean().default(false),
  })
  .strict()
  .superRefine((r, c) => {
    if (new Set(r.sections.map((s) => s.kind)).size !== r.sections.length)
      c.addIssue({ code: "custom", message: "Duplicate sections" });
    if (r.duration !== null && r.durationBasis === "unknown")
      c.addIssue({ code: "custom", message: "Duration needs a basis" });
  });
export type Source = z.infer<typeof sourceSchema>;
export type RecordEntry = {
  sourceId: string;
  fingerprint: string;
  source: Source;
  reviewedHash?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};
export function fingerprint(source: Source) {
  return createHash("sha256")
    .update(JSON.stringify(sourceSchema.parse(source)))
    .digest("hex");
}
/** Missing headings stay absent. Stop at personal/non-workout headings; a human must check retained text. */
export function extractSections(text: string): Source["sections"] {
  const output: Source["sections"] = [];
  let current: Source["sections"][number] | undefined;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line
      .trim()
      .replace(/^[#*_\s]+|[*_:\s]+$/g, "")
      .toLowerCase();
    if (
      /^(cot|circle of trust|prayer.*|announcements?|name.?o.?rama|count.?o.?rama|moleskin|pax|fngs?)$/.test(
        heading,
      )
    ) {
      current = undefined;
      continue;
    }
    const kind = /^(warm.?up|warm.?a.?rama)$/.test(heading)
      ? "warmup"
      : /^(the thang|thang)$/.test(heading)
        ? "thang"
        : /^(mary|6 minutes of mary)$/.test(heading)
          ? "mary"
          : null;
    if (kind) {
      current = { kind, text: "" };
      output.push(current);
    } else if (current) current.text += (current.text ? "\n" : "") + line;
  }
  return output
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text);
}
export function sourceIssues(s: Source): string[] {
  return [
    ...new Set([
      ...s.issues,
      ...(!s.q ? ["Q not supplied"] : []),
      ...(!s.ao ? ["AO not supplied"] : []),
      ...(!s.eventDate ? ["Event date not supplied"] : []),
      ...(!s.sections.some((x) => x.kind === "warmup")
        ? ["Warmup not supplied"]
        : []),
      ...(!s.sections.some((x) => x.kind === "mary") &&
      !s.issues.includes("Mary explicitly omitted in source")
        ? ["Mary not supplied; omission not confirmed"]
        : []),
      ...(s.duration === null
        ? ["Duration unknown"]
        : s.durationBasis === "inferred"
          ? ["Duration inferred"]
          : []),
      ...(!s.running
        ? ["Running requirement not supplied; inspect instructions"]
        : []),
      ...(!s.equipment.length
        ? ["Equipment not specified; inspect instructions"]
        : []),
      "Counts and exercise order retained as source text; verify counting rules before leading",
    ]),
  ];
}
export function mergeSources(existing: RecordEntry[], incoming: Source[]) {
  const map = new Map(existing.map((r) => [r.sourceId, structuredClone(r)]));
  if (map.size !== existing.length)
    throw Error("Duplicate existing source IDs");
  const batch = new Set<string>();
  for (const value of incoming) {
    const source = sourceSchema.parse(value);
    if (batch.has(source.sourceId))
      throw Error("Duplicate IDs in import batch");
    batch.add(source.sourceId);
    const hash = fingerprint(source),
      previous = map.get(source.sourceId);
    // Stable original ID; a changed source requires review again. Absent records are never deleted.
    if (previous?.fingerprint !== hash)
      map.set(source.sourceId, {
        sourceId: source.sourceId,
        fingerprint: hash,
        source,
      });
  }
  return [...map.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
}
export function approve(
  entry: RecordEntry,
  hash: string,
  reviewer: string,
  now = new Date().toISOString(),
): RecordEntry {
  if (hash !== entry.fingerprint || fingerprint(entry.source) !== hash)
    throw Error("Review hash is stale");
  if (
    entry.source.reuse.basis === "unresolved" ||
    !entry.source.reuse.evidence.trim()
  )
    throw Error("Reuse evidence required");
  if (
    entry.source.archived ||
    !entry.source.sections.some((s) => s.kind === "thang")
  )
    throw Error("Archived or missing The Thang");
  if (!entry.source.privacyReviewed)
    throw Error("Workout-only privacy review required");
  if (!reviewer.trim()) throw Error("Reviewer required");
  return {
    ...entry,
    reviewedHash: hash,
    reviewedBy: reviewer,
    reviewedAt: now,
  };
}
export function publishedWorkouts(entries: RecordEntry[]): Workout[] {
  return entries
    .filter(
      (r) =>
        !r.source.archived &&
        r.reviewedHash === r.fingerprint &&
        fingerprint(r.source) === r.fingerprint &&
        r.source.privacyReviewed &&
        r.source.reuse.basis !== "unresolved" &&
        !!r.source.reuse.evidence.trim() &&
        !!r.reviewedBy?.trim() &&
        !!r.reviewedAt,
    )
    .map((r) => {
      const s = r.source;
      return workoutSchema.parse({
        schemaVersion: 1,
        id: s.sourceId,
        kind: "source",
        title: s.title,
        summary: "Regional backblast · original workout instructions",
        duration: s.duration,
        equipment: s.equipment,
        running: s.running ?? "None",
        format: "Custom",
        sections: s.sections.map((x, i) => ({
          id: `section-${i}`,
          kind: x.kind,
          title:
            x.kind === "thang"
              ? "The Thang"
              : x.kind === "mary"
                ? "Mary"
                : "Warmup",
          blocks: [
            {
              id: `block-${i}`,
              title: "From the backblast",
              instructions: x.text,
              minutes: null,
              exercises: [],
            },
          ],
        })),
        rawNotes: "",
        adaptationNotes:
          "Imported original. No missing exercises or sections have been filled in. Check source notes before leading.",
        provenance: {
          status: "regional-reviewed",
          label: `Reviewed by ${r.reviewedBy}`,
          sourceId: s.sourceId,
          url: s.url,
          q: s.q,
          ao: s.ao,
          eventDate: s.eventDate,
          checkedAt: r.reviewedAt,
          issues: sourceIssues(s),
          durationBasis: s.durationBasis,
        },
        updatedAt: r.reviewedAt,
      });
    });
}
