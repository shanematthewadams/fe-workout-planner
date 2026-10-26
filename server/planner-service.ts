import { movementGuide, type MovementGuide } from "./exicon-intelligence.ts";
import { findAO } from "../src/ao-context.ts";
import {
  siteContext,
  blockedFeatures,
  detectFeatures,
  describeSite,
} from "../src/ao-context.ts";
import {
  resolvePlannerSite,
  type CatalogEnvironment,
} from "./ao-intelligence.ts";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import {
  resolveRequest,
  planSchema,
  type PlannerRequest,
  type Plan,
} from "../src/planner-contract.ts";
import { workoutSchema } from "../src/model.ts";
import {
  movementConflicts,
  requiredMovementFeatures,
  mentionsRestrictedNames,
  refinementConflicts,
} from "../src/plan-constraints.ts";
import { contextFor, F3_BRIEF, OUTPUT_SHAPE } from "./planner-context.ts";
export type AIEnvironment = {
  catalog?: CatalogEnvironment;
  exicon?: CatalogEnvironment;
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
export { resolveRequest } from "../src/planner-contract.ts";

export function enforceMovementGuide(
  plan: Plan,
  input: PlannerRequest,
  site: ReturnType<typeof siteContext>,
  guide?: MovementGuide,
) {
  const conflicts = movementConflicts(plan, input, guide?.movements);
  if (
    guide &&
    mentionsRestrictedNames(plan, [
      ...guide.blockedNames,
      ...guide.ambiguousAliases,
    ])
  )
    throw new PlannerError(
      422,
      "The draft uses an ambiguous exercise name or an unsupported facility requirement. Confirm the exercise before leading.",
    );
  if (conflicts.length) throw new PlannerError(422, conflicts.join(" "));
  const blocked = guide
    ? requiredMovementFeatures(plan, guide.movements).filter(
        (f) => site.features[f] !== "available",
      )
    : [];
  if (blocked.length)
    throw new PlannerError(
      422,
      "The draft needs unconfirmed or unavailable site features: " +
        blocked.join(", ") +
        ". Your previous draft is safe.",
    );
}

export function validatePlan(
  value: unknown,
  input: PlannerRequest,
  preparedSite?: ReturnType<typeof siteContext>,
  guide?: MovementGuide,
) {
  const p = planSchema.parse(value),
    kinds = p.sections.map((s) => s.kind);
  // Current AO facts confirm outdoor features, not indoor workout permission.
  // Check prominent claims; caveats in notes do not establish access.
  const description = `${p.title}. ${p.summary}`.replace(
    /\b(?:not|never|no|without|avoid)\s+indoor(?:s)?\b/gi,
    "",
  );
  if (/\bindoor(?:s)?\b/i.test(description))
    throw new PlannerError(
      422,
      "The AI claimed unconfirmed indoor workout access. A covered shelter does not establish indoor permission.",
    );
  if (
    (input.planning?.pax === 1 || input.planning?.grouping === "Individual") &&
    (p.format === "Partner" ||
      p.sections.some((s) =>
        s.blocks.some((b) =>
          /\b(?:pair up|partner [ab]|your partner|partners? alternate|swap partners?)\b/i.test(
            b.instructions,
          ),
        ),
      ))
  )
    throw new PlannerError(
      422,
      "The draft requires a partner despite your individual-work setup.",
    );
  const routeSession = input.planning && input.planning.activity !== "Bootcamp";
  if (
    kinds.join(",") !==
    (routeSession
      ? input.mary
        ? "thang,mary"
        : "thang"
      : input.mary
        ? "warmup,thang,mary"
        : "warmup,thang")
  )
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
      byKind("warmup") !== (routeSession ? 0 : 8) ||
      byKind("thang") !==
        (routeSession ? (input.mary ? 37 : 43) : input.mary ? 29 : 35) ||
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
  enforceMovementGuide(
    p,
    input,
    preparedSite ?? siteContext(input.ao, input.prompt, input.site),
    guide,
  );
  if (
    (input.equipment === "Coupon" ||
      (input.equipment === "From prompt" &&
        /coupon|cinder block/i.test(input.prompt))) &&
    !p.equipment.some((e) => /coupon|cinder block/i.test(e))
  )
    throw new PlannerError(422, "The AI left out your coupons. Try again.");
  {
    // Terrain safety applies to every caller, including non-strict API requests.
    const site =
      preparedSite ?? siteContext(input.ao, input.prompt, input.site);
    const blocked = blockedFeatures(p, site);
    if (blocked.length)
      throw new PlannerError(
        422,
        "The draft needs unconfirmed or unavailable site features: " +
          blocked.join(", ") +
          ". Your previous draft is safe.",
      );
  }
  const refinement = refinementConflicts(p, input);
  if (refinement.length) throw new PlannerError(422, refinement.join(" "));
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
  preparedSite?: ReturnType<typeof siteContext>,
  preparedGuide?: MovementGuide,
) {
  const input = resolveRequest(raw);
  const [site, guide] = await Promise.all([
    preparedSite ?? resolvePlannerSite(input, env.catalog),
    preparedGuide ??
      movementGuide(
        env.exicon,
        findAO(input.ao, input.prompt) ? "the-fe" : undefined,
      ),
  ]);
  const context = contextFor(input, site, guide);
  let system =
    F3_BRIEF +
    "\nWORKOUT DETAILS: verifiedContext.planning contains the Q's selected participant count, grouping, body focus, date, expected weather and expected light. Use groupingInstructions for workable roles, odd numbers and shared versus individual totals. Prioritize the selected body focus in The Thang while keeping an appropriate warmup and optional Mary. Follow conditionsInstructions in EVERY section: when Rain or Snow / ice is selected, use only controlled standing exercises, including standing core work for Mary. Do not prescribe floor exercises or jumps merely because shelter is available. Never turn a covered garage into claimed indoor access. The selections are expectations, not a fetched forecast. Never claim to have checked weather or sunrise/sunset. A date alone does not establish daylight. Darkness never proves lights or shelter are available. Explicit new refinement instructions override earlier preferences; preserve unmentioned conditions. These details do not override closures or create site features. In notes, briefly identify the requested body focus, grouping and selected conditions so they remain visible in the saved workout." +
    "\nReturn ONLY JSON matching this shape (example exercises are not a required plan): " +
    JSON.stringify(OUTPUT_SHAPE) +
    "\nUse ONLY these case-sensitive enums: running None|Light|Moderate; format Circuit|11s|EMOM|AMRAP|Ladder|Partner|Stations|Chipper|Custom; exercise unit reps|seconds|minutes|meters|rounds|instructions; counting total|1=1|2=1|per side|cadence|time|distance|not applicable. amount MUST be a string. No extra top-level fields. " +
    `\n${input.strictSchedule ? "STRICT SCHEDULE: 2 minutes welcome/disclaimer is reserved by the app outside these exercise sections. Warmup EXACTLY 8 minutes; The Thang EXACTLY " + (input.mary ? "29" : "35") + " minutes; Mary " + (input.mary ? "EXACTLY 6 minutes" : "OMITTED") + ". Fellowship/COT happens AFTER the 45-minute hard stop and must NOT appear in physical sections." : ""} All block minutes MUST sum to ${input.minutes - (input.strictSchedule ? 2 : 0)}. Required section order: ${input.mary ? "warmup, thang, mary" : "warmup, thang; OMIT Mary entirely"}. Every exercise requires amount/unit/counting/plain instructions. At most 10 exercises per block. Keep instructions concise. Never output ids, source metadata, raw notes or publication fields.`;
  const routeSession = input.planning && input.planning.activity !== "Bootcamp";
  const routeInstructions = routeSession
    ? `\nROUTE SESSION overrides bootcamp phase rules above: ${input.planning!.activity}. Required sections: ${input.mary ? "thang,mary" : "thang"}. No warmup section. ${input.strictSchedule ? `Thang exactly ${input.mary ? 37 : 43} minutes; ${input.mary ? "Mary exactly 6 minutes." : "No Mary."}` : "Fit the requested time."} Route is Q supplied; do not invent turns, distances, landmarks, permission or pace. Use route/distance/pace from verifiedContext.planning, set a time-based turnaround and regrouping plan, note COT after hard stop. Optional exercise stops only when requested. For rucking use Ruck equipment, and no running unless explicitly requested. For running use running Moderate unless Q requested no running. Clearly label target distance unmeasured unless verified. Return format Custom.`
    : "";
  system += routeInstructions;
  const message = JSON.stringify({ request: input, verifiedContext: context });
  const deadline = AbortSignal.any([
    AbortSignal.timeout(22000),
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
    // Reserve time for the second free provider when the first route stalls.
    const attempt = AbortSignal.any([
      deadline,
      AbortSignal.timeout(routes.length > 1 ? 10000 : 20000),
    ]);
    try {
      let text = "";
      if (route === "openrouter") {
        // Dedicated free router plus an explicit zero price ceiling. Never retry on a paid model or gateway.
        const r = await fetcher(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            redirect: "error",
            signal: attempt,
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
            signal: attempt,
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
      result = validatePlan(parseJSON(text), input, context.site, guide);
      break;
    } catch (error) {
      if (deadline.aborted)
        throw new PlannerError(
          504,
          "Free AI took too long. Your previous draft is safe. Try again.",
        );
      if (attempt.aborted) {
        lastStatus = 504;
        continue;
      }
      if (error instanceof PlannerError) {
        if (error.status === 422) {
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
      lastStatus === 504
        ? "Free AI took too long. Your previous draft is safe. Try again."
        : lastStatus === 429
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
