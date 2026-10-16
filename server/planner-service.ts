import {
  siteContext,
  blockedFeatures,
  detectFeatures,
  describeSite,
} from "../src/ao-context.ts";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import {
  plannerRequestSchema,
  planSchema,
  type PlannerRequest,
  type Plan,
} from "../src/planner-contract.ts";
import { workoutSchema } from "../src/model.ts";
import { contextFor, F3_BRIEF, OUTPUT_SHAPE } from "./planner-context.ts";
export type AIEnvironment = {
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GEMINI_FREE_TIER_CONFIRMED?: string;
};
export class PlannerError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
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
  return input;
}

export function validatePlan(value: unknown, input: PlannerRequest) {
  const p = planSchema.parse(value),
    kinds = p.sections.map((s) => s.kind);
  if (kinds.join(",") !== (input.mary ? "warmup,thang,mary" : "warmup,thang"))
    throw new PlannerError(
      422,
      "The AI left out or reordered a section. Your previous draft is safe. Try again.",
    );
  const minutes = p.sections
    .flatMap((s) => s.blocks)
    .reduce((n, b) => n + b.minutes, 0);
  if (input.strictSchedule) {
    const byKind = (kind: string) =>
      p.sections
        .find((s) => s.kind === kind)
        ?.blocks.reduce((n, b) => n + b.minutes, 0) ?? 0;
    if (
      byKind("warmup") !== 8 ||
      byKind("thang") !== (input.mary ? 29 : 35) ||
      (input.mary && byKind("mary") !== 6)
    )
      throw new PlannerError(
        422,
        "The AI did not fit the strict phase schedule.",
      );
  }
  if (
    Math.abs(minutes - (input.minutes - (input.strictSchedule ? 2 : 0))) >
    (input.strictSchedule ? 0 : 0.5)
  )
    throw new PlannerError(
      422,
      "The AI timing did not fit your session. Your previous draft is safe. Try again.",
    );
  if (input.running !== "From prompt" && p.running !== input.running)
    throw new PlannerError(
      422,
      "The AI did not follow the running preference. Try again.",
    );
  if (input.equipment === "None" && p.equipment.length)
    throw new PlannerError(
      422,
      "The AI added equipment to a no-equipment plan. Try again.",
    );
  if (
    (input.equipment === "Coupon" ||
      (input.equipment === "From prompt" &&
        /coupon|cinder block/i.test(input.prompt))) &&
    !p.equipment.some((e) => /coupon|cinder block/i.test(e))
  )
    throw new PlannerError(422, "The AI left out your coupons. Try again.");
  if (input.strictSchedule) {
    const blocked = blockedFeatures(
      p,
      siteContext(input.ao, input.prompt, input.site),
    );
    if (blocked.length)
      throw new PlannerError(
        422,
        "The draft needs unconfirmed or unavailable site features: " +
          blocked.join(", ") +
          ". Your previous draft is safe.",
      );
  }
  return p;
}
function parseJSON(text: string) {
  return JSON.parse(
    text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""),
  );
}
export async function generatePlan(
  raw: unknown,
  env: AIEnvironment,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
) {
  const input = resolveRequest(raw),
    context = contextFor(input);
  const system =
    F3_BRIEF +
    "\nReturn ONLY JSON matching this shape (example exercises are not a required plan): " +
    JSON.stringify(OUTPUT_SHAPE) +
    "\nUse ONLY these case-sensitive enums: running None|Light|Moderate; format Circuit|11s|EMOM|AMRAP|Ladder|Partner|Stations|Chipper|Custom; exercise unit reps|seconds|minutes|meters|rounds|instructions; counting total|1=1|2=1|per side|cadence|time|distance|not applicable. amount MUST be a string. No extra top-level fields. " +
    `\n${input.strictSchedule ? "STRICT SCHEDULE: 2 minutes welcome/disclaimer is reserved by the app outside these exercise sections. Warmup EXACTLY 8 minutes; The Thang EXACTLY " + (input.mary ? "29" : "35") + " minutes; Mary " + (input.mary ? "EXACTLY 6 minutes" : "OMITTED") + ". Fellowship/COT happens AFTER the 45-minute hard stop and must NOT appear in physical sections." : ""} All block minutes MUST sum to ${input.minutes - (input.strictSchedule ? 2 : 0)}. Required section order: ${input.mary ? "warmup, thang, mary" : "warmup, thang; OMIT Mary entirely"}. Every exercise requires amount/unit/counting/plain instructions. At most 10 exercises per block. Keep instructions concise. Never output ids, source metadata, raw notes or publication fields.`;
  const message = JSON.stringify({ request: input, verifiedContext: context });
  const deadline = AbortSignal.any([
    AbortSignal.timeout(20000),
    ...(signal ? [signal] : []),
  ]);
  let result: Plan | undefined,
    provider: "OpenRouter" | "Gemini" = "OpenRouter",
    model = "",
    lastStatus = 503;
  // Gemini is opt-in only after the project tier is independently confirmed. A model name alone cannot enforce zero billing.
  const routes = [
    ...(input.provider !== "openrouter" &&
    env.GEMINI_API_KEY &&
    env.GEMINI_FREE_TIER_CONFIRMED === "true"
      ? ["gemini"]
      : []),
    ...(input.provider !== "gemini" && env.OPENROUTER_API_KEY
      ? ["openrouter"]
      : []),
  ];
  if (!routes.length)
    throw new PlannerError(
      503,
      "Free AI is not configured yet. You can still build a workout manually.",
    );
  for (const route of routes) {
    try {
      let text = "";
      if (route === "openrouter") {
        // Dedicated free router plus an explicit zero price ceiling. Never retry on a paid model or gateway.
        const r = await fetcher(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            redirect: "error",
            signal: deadline,
            headers: {
              Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openrouter/free",
              provider: { max_price: { prompt: 0, completion: 0 } },
              messages: [
                { role: "system", content: system },
                { role: "user", content: message },
              ],
              response_format: { type: "json_object" },
              max_tokens: 4200,
              temperature: 0.55,
            }),
          },
        );
        if (!r.ok) {
          console.info(
            "FE_PLANNER_UPSTREAM",
            JSON.stringify({ provider: route, status: r.status }),
          );
          lastStatus = r.status === 429 ? 429 : 503;
          continue;
        }
        const data = await r.json();
        text = data.choices?.[0]?.message?.content ?? "";
        model = String(data.model ?? "openrouter/free");
        provider = "OpenRouter";
      } else {
        const r = await fetcher(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
          {
            method: "POST",
            redirect: "error",
            signal: deadline,
            headers: {
              "x-goog-api-key": env.GEMINI_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: "user", parts: [{ text: message }] }],
              generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 4200,
                temperature: 0.55,
                thinkingConfig: { thinkingLevel: "minimal" },
              },
            }),
          },
        );
        if (!r.ok) {
          console.info(
            "FE_PLANNER_UPSTREAM",
            JSON.stringify({ provider: route, status: r.status }),
          );
          lastStatus = r.status === 429 ? 429 : 503;
          continue;
        }
        const data = await r.json();
        text = (data.candidates?.[0]?.content?.parts ?? [])
          .filter((p: { thought?: boolean }) => !p.thought)
          .map((p: { text?: string }) => p.text ?? "")
          .join("");
        model = "gemini-3.5-flash-lite";
        provider = "Gemini";
      }
      if (text.length > 35000)
        throw new PlannerError(
          422,
          "The AI draft was too long. Try a simpler request.",
        );
      result = validatePlan(parseJSON(text), input);
      break;
    } catch (error) {
      if (deadline.aborted)
        throw new PlannerError(
          504,
          "Free AI took too long. Your previous draft is safe. Try again.",
        );
      if (error instanceof PlannerError) {
        if (error.status === 422 && /site features/.test(error.message)) {
          lastStatus = 422;
          continue;
        }
        throw error;
      }
      console.info(
        "FE_PLANNER_INVALID",
        JSON.stringify({
          provider: route,
          issues:
            error instanceof ZodError
              ? error.issues.map((i) => ({ path: i.path, code: i.code }))
              : [{ code: "invalid_json_or_response" }],
        }),
      );
      lastStatus = 422;
    }
  }
  if (!result)
    throw new PlannerError(
      lastStatus,
      lastStatus === 429
        ? "Free AI has reached its current limit. Your draft is safe. Try later or edit manually."
        : lastStatus === 422
          ? "The AI returned an incomplete draft. Your previous draft is safe. Try again."
          : "Free AI is busy or unavailable. Your previous draft is safe. Try later or edit manually.",
    );
  const references = context.references.map(({ id, title, url }) => ({
    id,
    title,
    url,
  }));
  const id = "ai-" + randomUUID(),
    now = new Date().toISOString();
  const workout = workoutSchema.parse({
    schemaVersion: 1,
    id,
    title: result.title,
    summary: result.summary,
    kind: "personal",
    duration: input.minutes,
    equipment: result.equipment,
    running: result.running,
    format: result.format,
    schedule: {
      startTime: input.startTime,
      requiredFeatures: [
        ...new Set([
          ...(result.requiredFeatures ?? []),
          ...detectFeatures(result),
        ]),
      ],
      siteSummary: describeSite(context.site),
    },
    sections: result.sections.map((s, si) => ({
      ...s,
      id: `s-${si}`,
      blocks: s.blocks.map((b, bi) => ({
        ...b,
        id: `b-${si}-${bi}`,
        exercises: b.exercises.map((e, ei) => ({
          ...e,
          id: `e-${si}-${bi}-${ei}`,
        })),
      })),
    })),
    rawNotes: "",
    adaptationNotes: [
      "AI-assisted personal draft. Review counts, timing and modifications before leading.",
      ...result.notes,
    ].join("\n"),
    provenance: {
      status: "personal",
      label: `AI-assisted draft · ${provider} · not a reviewed regional original`,
      ao: context.ao?.name ?? (input.ao || undefined),
      q: input.builder?.qName || undefined,
      durationBasis: "inferred",
      issues: [
        "All timings are estimates, including explanation, rest and transitions.",
        "AO terrain, distances, equipment stock and weather suitability must be confirmed by Q.",
      ],
      generation: {
        provider,
        model,
        referenceSourceIds: references.map((r) => r.id),
      },
    },
    updatedAt: now,
  });
  return { workout, plan: result, provider, model, references };
}
