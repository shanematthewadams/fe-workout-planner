import { zodToJsonSchema } from "zod-to-json-schema";
import {
  planSchema,
  type Plan,
  type PlannerRequest,
} from "../src/planner-contract.ts";

// Provider grammars receive structural constraints derived from our real contract.
// Length/count/range limits stay enforced by planSchema after generation. Omitting
// them here avoids large grammar expansion in this deeply nested workout shape.
function structural(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structural);
  if (!value || typeof value !== "object") return value;
  const keep = new Set([
    "type",
    "enum",
    "properties",
    "items",
    "required",
    "additionalProperties",
    "anyOf",
  ]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => keep.has(key))
      .map(([key, item]) => [
        key,
        key === "properties"
          ? Object.fromEntries(
              Object.entries(item as Record<string, unknown>).map(
                ([name, schema]) => [name, structural(schema)],
              ),
            )
          : structural(item),
      ]),
  );
}
export const plannerOutputSchema = structural(
  zodToJsonSchema(planSchema, { $refStrategy: "none" }),
);

const refinementSchema = planSchema.partial();
export const plannerRefinementSchema = structural(
  zodToJsonSchema(refinementSchema, { $refStrategy: "none" }),
);

export function applyPlannerRefinement(
  value: unknown,
  current: Plan,
  input: PlannerRequest,
) {
  const patch = refinementSchema.parse(value);
  const kinds = sectionOrder(input);
  const replacements = new Map(patch.sections?.map((s) => [s.kind, s]));
  if (
    replacements.size !== (patch.sections?.length ?? 0) ||
    patch.sections?.some((s) => !kinds.includes(s.kind))
  )
    throw new ProviderOutputError("constraints");
  return {
    ...current,
    ...patch,
    sections: kinds.map(
      (kind) =>
        replacements.get(kind) ?? current.sections.find((s) => s.kind === kind),
    ),
  };
}

function sectionOrder(
  input: PlannerRequest,
): Plan["sections"][number]["kind"][] {
  const route = input.planning && input.planning.activity !== "Bootcamp";
  return route
    ? input.mary
      ? ["thang", "mary"]
      : ["thang"]
    : input.mary
      ? ["warmup", "thang", "mary"]
      : ["warmup", "thang"];
}

export function scheduleInstructions(input: PlannerRequest) {
  const route = input.planning && input.planning.activity !== "Bootcamp";
  const kinds = sectionOrder(input);
  const total = input.minutes - (input.strictSchedule ? 2 : 0);
  return (
    `Required section order: ${kinds.join(",")}. Omit every other section. Block minutes must sum to ${total}. ` +
    (input.strictSchedule
      ? `STRICT SCHEDULE: the app reserves 2 minutes for welcome/disclaimer. ${route ? "No warmup section. " : "Warmup exactly 8 minutes. "}The Thang exactly ${route ? (input.mary ? 37 : 43) : input.mary ? 29 : 35} minutes.${input.mary ? " Mary exactly 6 minutes." : " Omit Mary."} Include rest, explanation and transitions within these budgets. COT is after the hard stop, outside physical sections.`
      : "Include rest, explanation and transitions within the requested time.")
  );
}

export type AttemptOutcome =
  | "valid"
  | "http"
  | "timeout"
  | "cancelled"
  | "invalid_json"
  | "schema"
  | "constraints"
  | "empty"
  | "truncated"
  | "blocked"
  | "response";
export class ProviderOutputError extends Error {
  constructor(public outcome: AttemptOutcome) {
    super("Provider output: " + outcome);
  }
}
export function parseProviderJSON(text: unknown) {
  if (typeof text !== "string") throw new ProviderOutputError("response");
  if (!text.trim()) throw new ProviderOutputError("empty");
  if (text.length > 35000) throw new ProviderOutputError("response");
  // Accept a single complete JSON fence. Never extract arbitrary prose, invent
  // missing fields, repair truncated JSON or coerce exercise mechanics.
  try {
    return JSON.parse(
      text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""),
    );
  } catch {
    throw new ProviderOutputError("invalid_json");
  }
}
