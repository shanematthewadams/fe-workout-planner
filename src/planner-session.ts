import { z } from "zod";
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
export function restorePlannerSession(): PlannerSession {
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
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (!value) return empty;
    // Recover older v1 sessions. Optional newer fields fail independently so an
    // invalid form field cannot discard an otherwise recoverable workout.
    const result = plannerResponseSchema.safeParse(value.result);
    const preferences = plannerRequestSchema
      .omit({ prompt: true, current: true })
      .safeParse(value.preferences ?? {});
    const builder = plannerRequestSchema.shape.builder.safeParse(value.builder);
    const request = plannerRequestSchema.safeParse(value.request);
    return {
      prompt:
        typeof value.prompt === "string" ? value.prompt.slice(0, 1800) : "",
      result: result.success ? result.data : null,
      preferences: preferences.success ? preferences.data : empty.preferences,
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
