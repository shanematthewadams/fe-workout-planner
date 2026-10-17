import {
  featureSchema,
  siteInputSchema,
  startTimeSchema,
} from "./site-contract";
import { z } from "zod";
import { exerciseSchema, workoutSchema } from "./model";
const short = z.string().trim().min(1).max(3000);
export const planSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    summary: z.string().trim().min(1).max(600),
    equipment: z.array(z.string().min(1).max(80)).max(8),
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
    sections: z
      .array(
        z.object({
          kind: z.enum(["warmup", "thang", "mary"]),
          title: z.string().min(1).max(100),
          blocks: z
            .array(
              z.object({
                title: z.string().min(1).max(100),
                instructions: short,
                minutes: z.number().positive().max(60),
                exercises: z
                  .array(
                    exerciseSchema.omit({ id: true }).extend({
                      name: z.string().min(1).max(120),
                      amount: z.string().min(1).max(120),
                      instructions: short,
                    }),
                  )
                  .min(1)
                  .max(12),
              }),
            )
            .min(1)
            .max(6),
        }),
      )
      .min(2)
      .max(3),
    requiredFeatures: z.array(featureSchema).max(11).optional(),
    notes: z.array(z.string().min(1).max(400)).max(10),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export const plannerRequestSchema = z
  .object({
    prompt: z.string().trim().min(3).max(1800),
    ao: z.string().max(160).default(""),
    minutes: z.number().int().min(20).max(60).default(45),
    equipment: z.enum(["From prompt", "Coupon", "None"]).default("From prompt"),
    running: z
      .enum(["From prompt", "None", "Light", "Moderate"])
      .default("From prompt"),
    mary: z.boolean().default(true),
    provider: z.enum(["auto", "gemini", "openrouter"]).default("auto"),
    strictSchedule: z.boolean().default(false),
    startTime: startTimeSchema.default("05:30"),
    site: siteInputSchema.optional(),
    builder: z
      .object({
        title: z.string().max(120).default(""),
        qName: z.string().max(160).default(""),
        focus: z.string().max(80).default("Full body"),
        style: z.enum([
          "Dora 1-2-3",
          "The 11s",
          "Four Corners",
          "Route 66",
          "Iron Hulk",
          "The Grinder",
          "Tabata",
          "Deck of Death",
          "IPC-inspired",
        ]),
        gear: z
          .array(
            z.enum([
              "Coupon",
              "Bleachers / stairs",
              "Ruck",
              "Pull-up bar",
              "Cones",
              "Dumbbells / kettlebells",
            ]),
          )
          .max(6),
        terrain: z.string().max(120).default("Q to confirm"),
        pax: z.number().int().min(1).max(200).default(12),
      })
      .strict()
      .optional(),
    current: planSchema.optional(),
  })
  .strict();
export type PlannerRequest = z.infer<typeof plannerRequestSchema>;
export const plannerResponseSchema = z.object({
  workout: workoutSchema,
  plan: planSchema,
  provider: z.enum(["OpenRouter", "Gemini", "Template"]),
  model: z.string(),
  fallbackReason: z.string().max(500).optional(),
  references: z
    .array(
      z.object({ id: z.string(), title: z.string(), url: z.string().url() }),
    )
    .max(3),
});
export type PlannerResponse = z.infer<typeof plannerResponseSchema>;
export const GOLD_RUSH_EXAMPLE =
  "I have a Q at Gold Rush. I want to use coupons. I’d like the theme to be something about digging for gold.";

export function resolveRequest(raw: unknown) {
  const input = plannerRequestSchema.parse(raw);
  const time = input.prompt.match(
    /\b(20|25|30|35|40|45|50|55|60)[ -]?(?:min(?:ute)?s?)\b/i,
  );
  if (time && !input.strictSchedule) input.minutes = Number(time[1]);
  if (input.strictSchedule) input.minutes = 45;
  if (/\b(?:no|without|skip|omit)\s+(?:closing\s+)?mary\b/i.test(input.prompt))
    input.mary = false;
  else if (/\b(?:add|include|with)\s+(?:closing\s+)?mary\b/i.test(input.prompt))
    input.mary = true;
  if (
    input.running === "From prompt" &&
    /\b(?:no|zero|without|skip|avoid)\s+(?:the\s+)?running\b/i.test(
      input.prompt,
    )
  )
    input.running = "None";
  if (
    input.equipment === "From prompt" &&
    /\b(?:no|without|remove|skip|avoid|don.t want|do not want|don.t use|do not use)\s+(?:any\s+)?(?:coupons?|cinder blocks?|equipment)\b/i.test(
      input.prompt,
    )
  )
    input.equipment = "None";
  else if (
    input.equipment === "From prompt" &&
    /\b(?:coupons?|cindy|cinder blocks?)\b/i.test(input.prompt)
  )
    input.equipment = "Coupon";
  if (
    input.equipment === "From prompt" &&
    /\bbody[ -]?weight(?: only)?\b/i.test(input.prompt)
  )
    input.equipment = "None";
  return input;
}
