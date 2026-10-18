import { z } from "zod";

export const WEATHER = ["Rain", "Wind", "Snow / ice", "Hot", "Cold"] as const;
export const LIGHT = ["Not sure", "Daylight", "Dawn / dusk", "Dark"] as const;
export const GROUPING = [
  "Let the plan decide",
  "Individual",
  "Partners",
  "Groups of 3",
  "Groups of 4",
] as const;
export const FOCUS = [
  "Full body",
  "Upper body",
  "Lower body",
  "Core",
  "Cardio endurance",
  "Ruck strength",
  "HIIT",
] as const;
export const planningDetailsSchema = z
  .object({
    date: z
      .string()
      .refine(
        (value) =>
          !value ||
          (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
            !Number.isNaN(Date.parse(value)) &&
            new Date(value).toISOString().slice(0, 10) === value),
        "Choose a valid workout date.",
      )
      .default(""),
    weather: z.array(z.enum(WEATHER)).max(5).default([]),
    light: z.enum(LIGHT).default("Not sure"),
    grouping: z.enum(GROUPING).default("Let the plan decide"),
    pax: z.number().int().min(1).max(200).optional(),
    focus: z.string().max(80).default("Full body"),
  })
  .strict();
export type PlanningDetails = z.infer<typeof planningDetailsSchema>;
export function refinePlanning(details: PlanningDetails, text: string) {
  const next = { ...details, weather: [...details.weather] };
  const count = text.match(
    /\b(\d{1,3})\s+(?:pax|guys|men|people|participants)\b/i,
  );
  if (count && Number(count[1]) >= 1 && Number(count[1]) <= 200)
    next.pax = Number(count[1]);
  const target = text
    .match(
      /\b(?:focus(?:\s+on)?|target|make (?:it|this))\s+(?:the\s+)?(upper[ -]body|lower[ -]body|legs|core|full[ -]body)\b/i,
    )?.[1]
    .toLowerCase();
  if (target)
    next.focus = target.startsWith("upper")
      ? "Upper body"
      : target.startsWith("lower") || target === "legs"
        ? "Lower body"
        : target === "core"
          ? "Core"
          : "Full body";
  if (
    /\b(?:no partners?|individual work|make (?:it|this) individual)\b/i.test(
      text,
    )
  )
    next.grouping = "Individual";
  else if (
    /\b(?:make (?:it|this) partner[ -]?(?:based)?|use partners?|pair up)\b/i.test(
      text,
    )
  )
    next.grouping = "Partners";
  else if (/\bgroups? of [34]\b/i.test(text))
    next.grouping = /\bgroups? of 3\b/i.test(text)
      ? "Groups of 3"
      : "Groups of 4";
  if (/\b(?:no rain|not raining|isn.t raining|without rain)\b/i.test(text))
    next.weather = next.weather.filter((w) => w !== "Rain");
  else if (
    /\b(?:raining|rainy|rain expected|wet weather)\b/i.test(text) &&
    !next.weather.includes("Rain")
  )
    next.weather.push("Rain");
  if (/\b(?:now daylight|in daylight|will be daylight)\b/i.test(text))
    next.light = "Daylight";
  else if (
    /\b(?:now dark|in the dark|will be dark|before sunrise)\b/i.test(text)
  )
    next.light = "Dark";
  return next;
}

export function groupDescription(
  pax: number | undefined,
  grouping: PlanningDetails["grouping"],
) {
  if (pax === 1)
    return "One participant: individual work only; no partner dependency.";
  if (!pax)
    return "Participant count unknown. Explain how to handle odd numbers and small turnouts without inventing a count.";
  if (grouping === "Partners" && pax === 3)
    return "Three participants: one group of three. Rotate work/rest roles; no one waits alone.";
  if (grouping === "Partners")
    return pax % 2
      ? `${pax} participants: ${(pax - 3) / 2} pairs and one group of three. Rotate work/rest roles in the trio; no one waits alone.`
      : `${pax} participants: ${pax / 2} pairs. State whether counts are individual or shared.`;
  if (grouping === "Groups of 3" || grouping === "Groups of 4") {
    const target = grouping === "Groups of 3" ? 3 : 4;
    const count = Math.ceil(pax / target),
      base = Math.floor(pax / count),
      extra = pax % count;
    const sizes = Array.from(
      { length: count },
      (_, index) => base + Number(index < extra),
    );
    return `${pax} participants: group sizes ${sizes.join(", ")}. Give each person a role and specify how they rotate; do not multiply individual targets by the group size.`;
  }
  return `${pax} participants. ${grouping === "Individual" ? "Individual work; no partner dependency." : "Choose a workable individual, partner, or small-group format; explain roles and handle odd numbers."}`;
}

export function planningContext(
  details?: PlanningDetails,
  legacy?: { pax: number; focus: string },
) {
  const planning = planningDetailsSchema.parse(
    details ?? { pax: legacy?.pax, focus: legacy?.focus },
  );
  return {
    ...planning,
    groupingInstructions: groupDescription(planning.pax, planning.grouping),
    conditionsSource:
      "Q-selected expectations, not a live forecast or measured sunrise/sunset. Date and start time do not establish daylight. Unspecified conditions stay unknown.",
    conditionsInstructions: [
      planning.weather.some((w) => w === "Rain" || w === "Snow / ice")
        ? "Prefer standing, controlled work and short transitions. Avoid ground-contact core work, jumping, sprints, and direction changes on potentially slippery surfaces. Confirm footing; do not assume shelter."
        : "",
      planning.weather.includes("Wind")
        ? "Avoid loose equipment or objects that can blow away; keep stations close together."
        : "",
      planning.weather.includes("Hot")
        ? "Provide explicit water and recovery breaks and options to reduce work; do not turn the theme into forced intensity."
        : "",
      planning.weather.includes("Cold")
        ? "Use a gradual warmup and recovery without long motionless waits."
        : "",
      planning.light === "Dark" || planning.light === "Dawn / dusk"
        ? "Use compact, clearly bounded work with controlled transitions. Confirm lighting and footing; no racing, remote routes, or assumed visibility."
        : "",
    ].filter(Boolean),
  };
}
