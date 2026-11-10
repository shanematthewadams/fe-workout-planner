import { z } from "zod";
import { exiconCatalogSchema } from "./exicon-catalog";
export const codexPlannerLinkSchema = z
  .object({
    exercise_id: z.string().min(1).nullable(),
    format_id: z.string().min(1).nullable(),
    entry_id: z.string().min(1).max(512),
    entry_name: z.string().min(1).max(500),
    description: z.string().min(1).max(100000).nullable(),
    relation: z.enum(["equivalent", "local-adaptation"]),
    review_note: z.string().min(1).max(3000),
    reviewed_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    (l) => Number(l.exercise_id !== null) + Number(l.format_id !== null) === 1,
    "One review target required",
  )
  .refine(
    (l) => l.relation !== "local-adaptation" || l.description === null,
    "Local adaptations must retain local mechanics",
  );
export const plannerExiconSchema = exiconCatalogSchema
  .extend({ codex_links: z.array(codexPlannerLinkSchema).max(5000).optional() })
  .strict()
  .refine((c) => {
    const keys = (c.codex_links ?? []).map(
      (l) =>
        (l.exercise_id ? "exercise:" : "format:") +
        (l.exercise_id ?? l.format_id),
    );
    return new Set(keys).size === keys.length;
  }, "Duplicate planner reference target");
export type PlannerExiconCatalog = z.infer<typeof plannerExiconSchema>;
export type CodexPlanningReference = {
  officialId: string;
  name: string;
  url: string;
  relation: "equivalent" | "local-adaptation";
  description: string | null;
  reviewNote: string;
  reviewedAt: string;
  attribution: "F3 Nation · F3 Codex";
};
