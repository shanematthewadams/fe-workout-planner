import { z } from "zod";
const text = z.string().trim().min(1).max(100000);
const id = z.string().min(1).max(512);
export const codexReferenceEntrySchema = z
  .object({
    id,
    name: text,
    description: text,
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    captured_at: z.string().datetime({ offset: true }),
    aliases: z.array(text).max(100),
    tags: z.array(text).max(100),
    mentioned_ids: z.array(id).max(500),
  })
  .strict();
export const codexReferenceSchema = z
  .object({
    version: z.literal(1),
    attribution: z.literal("F3 Nation · F3 Codex"),
    entries: z.array(codexReferenceEntrySchema).max(5000),
  })
  .strict()
  .refine(
    (d) => new Set(d.entries.map((e) => e.id)).size === d.entries.length,
    "Duplicate Codex identity",
  );
export type CodexReference = z.infer<typeof codexReferenceSchema>;
export const codexEntryURL = (id: string) =>
  "https://codex.f3nation.com/exicon?entryId=" + encodeURIComponent(id);
export function searchCodex(
  reference: CodexReference,
  query: string,
  tag = "All",
) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return reference.entries
    .filter(
      (e) =>
        (tag === "All" || e.tags.includes(tag)) &&
        words.every((w) =>
          [e.name, e.description, ...e.aliases, ...e.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(w),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
