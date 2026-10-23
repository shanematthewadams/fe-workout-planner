import { z } from "zod";
import { planningDetailsSchema } from "./planning-details";
import {
  plannerRequestSchema,
  plannerResponseSchema,
  type PlannerRequest,
  type PlannerResponse,
} from "./planner-contract";

export const SESSION_KEY = "fe-planner:assistant:v1";
const defaultBuilder = {
  title: "",
  qName: "",
  focus: "Full body",
  style: "Dora 1-2-3" as const,
  gear: [],
  terrain: "Q to confirm",
  pax: 12,
};
export type PlannerSession = {
  prompt: string;
  result: PlannerResponse | null;
  preferences: Omit<PlannerRequest, "prompt" | "current">;
  mode: "idea" | "formal";
  builder: NonNullable<PlannerRequest["builder"]>;
  revision: string;
  request: PlannerRequest | null;
};
export function restorePlannerSession(key = SESSION_KEY): PlannerSession {
  const empty: PlannerSession = {
    prompt: "",
    result: null,
    preferences: plannerRequestSchema
      .omit({ prompt: true, current: true })
      .parse({}),
    mode: "idea",
    builder: defaultBuilder,
    revision: "",
    request: null,
  };
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value) return empty;
    // Recover older v1 sessions. Optional newer fields fail independently so an
    // invalid form field cannot discard an otherwise recoverable workout.
    const result = plannerResponseSchema.safeParse(value.result);
    const preferences = plannerRequestSchema
      .omit({ prompt: true, current: true })
      .safeParse({ ...value.preferences, planning: undefined });
    const planning = planningDetailsSchema
      .optional()
      .safeParse(value.preferences?.planning);
    const builder = plannerRequestSchema.shape.builder.safeParse(value.builder);
    const request = plannerRequestSchema.safeParse(value.request);
    return {
      prompt:
        typeof value.prompt === "string" ? value.prompt.slice(0, 1800) : "",
      result: result.success ? result.data : null,
      preferences: preferences.success
        ? {
            ...preferences.data,
            planning: planning.success ? planning.data : undefined,
          }
        : empty.preferences,
      mode: value.mode === "formal" ? "formal" : "idea",
      builder: builder.success && builder.data ? builder.data : defaultBuilder,
      revision: z.string().max(1800).safeParse(value.revision).success
        ? value.revision
        : "",
      request: request.success ? request.data : null,
    };
  } catch {
    return empty;
  }
}

/** Clear only this account's planning workspace, never the saved collection. */
export function clearPlannerSession(key = SESSION_KEY): boolean {
  const keys = [key, key + ":flow", key + ":weinke"];
  let previous: (string | null)[];
  try {
    previous = keys.map((item) => sessionStorage.getItem(item));
  } catch {
    return false;
  }
  try {
    keys.forEach((item) => sessionStorage.removeItem(item));
    return true;
  } catch {
    // Keep recovery copies if removal failed partway through; the UI stays open.
    keys.forEach((item, index) => {
      try {
        if (previous[index] !== null)
          sessionStorage.setItem(item, previous[index]!);
      } catch {
        /* In-memory notes stay available even when storage is blocked. */
      }
    });
    return false;
  }
}
