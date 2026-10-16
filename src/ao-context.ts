import { aoProfiles } from "./discovery";
import { aoKey } from "./model";
import {
  FEATURES,
  type Feature,
  type Availability,
  type SiteInput,
} from "./site-contract";
export function findAO(name: string, prompt = "") {
  const needle = aoKey(name || prompt);
  return aoProfiles.find((a) =>
    name ? aoKey(a.name) === needle : needle.includes(aoKey(a.name)),
  );
}
export function siteContext(aoName: string, prompt = "", site?: SiteInput) {
  const ao = findAO(aoName, prompt);
  const features = Object.fromEntries(
    Object.keys(FEATURES).map((key) => [
      key,
      ao?.local.features?.[key as Feature]?.state ?? "unknown",
    ]),
  ) as Record<Feature, Availability>;
  const notes = site?.notes ?? "";
  const terms: Record<Feature, string> = {
    track: "track",
    stairs: "(?:stairs|steps|bleachers)",
    parkingLot: "parking lot",
    shelter: "(?:shelter|pavilion|covered garage)",
    hills: "hills?",
    field: "(?:field|grass|turf)",
    pullupBars: "pull[ -]?up bars?",
    benches: "benches|bench",
    walls: "walls?",
    runningRoute: "(?:measured route|running loop|measured running route)",
  };
  const claims: Partial<Record<Feature, Availability>> = {};
  const clauses = (notes + "\n" + prompt).split(/[,!.;\n]|\bbut\b/i);
  for (const clause of clauses) {
    const uncertain =
      /\?|\b(?:if|maybe|might|could|possibly|assume|hopefully|whether|unless|would)\b/i.test(
        clause,
      );
    for (const feature of Object.keys(terms) as Feature[]) {
      const noun = "\\b(?:" + terms[feature] + ")\\b";
      const present = new RegExp(noun, "i").test(clause);
      if (!present) continue;
      const negative =
        /\b(?:no|not|don.t|avoid|skip|without|closed|unavailable|off limits|muddy|flooded|icy)\b/i.test(
          clause,
        );
      if (
        negative &&
        !uncertain &&
        new RegExp(
          noun +
            "[^,]{0,35}\\b(?:closed|unavailable|not available|off limits|muddy|flooded|icy)\\b|\\b(?:no|avoid|skip|without)\\s+(?:access\\s+to\\s+)?(?:the\\s+)?(?:stadium\\s+)?" +
            noun +
            "|\\b(?:do not|don.t)\\s+(?:use|have)\\s+(?:the\\s+)?" +
            noun,
          "i",
        ).test(clause)
      )
        claims[feature] = "unavailable";
      else if (
        !negative &&
        !uncertain &&
        (new RegExp(
          noun + "\\s+(?:(?:is|are)\\s+)?(?:available|open|accessible)\\b",
          "i",
        ).test(clause) ||
          new RegExp(
            "\\b(?:we|i)\\s+(?:have(?:\\s+access\\s+to)?|can\\s+use)\\s+(?:[a-z0-9-]+\\s+){0,3}" +
              noun,
            "i",
          ).test(clause))
      )
        claims[feature] = "available";
    }
  }
  // A Q statement is temporary task context, never a regional publication.
  for (const [key, value] of Object.entries(claims))
    if (value) features[key as Feature] = value;
  for (const [key, value] of Object.entries(site?.overrides ?? {}))
    if (value) features[key as Feature] = value;
  // A closure stated in text always wins over availability for this request.
  for (const [key, value] of Object.entries(claims))
    if (value === "unavailable") features[key as Feature] = value;
  return {
    ao: ao?.name ?? aoName,
    features,
    available: (Object.keys(FEATURES) as Feature[]).filter(
      (f) => features[f] === "available",
    ),
    unavailable: (Object.keys(FEATURES) as Feature[]).filter(
      (f) => features[f] === "unavailable",
    ),
    unknown: (Object.keys(FEATURES) as Feature[]).filter(
      (f) => features[f] === "unknown",
    ),
    details: ao?.local.features ?? {},
    sourceUrl: ao?.local.sourceUrl,
    reviewedAt: ao?.local.checkedAt,
    todayNotes: notes,
    temporaryOverrides: site?.overrides ?? {},
    qStatements: claims,
  };
}
/** Inspect physical instructions too; an empty AI dependency list cannot bypass the rule. */
export function detectFeatures(plan: {
  sections: {
    blocks: {
      instructions: string;
      exercises: { name: string; instructions: string }[];
    }[];
  }[];
}): Feature[] {
  const text = plan.sections
    .flatMap((s) =>
      s.blocks.flatMap((b) => [
        b.instructions,
        ...b.exercises.map((e) => e.name + " " + e.instructions),
      ]),
    )
    .join("\n")
    .replace(/\b(?:keep|keeping)\s+track\s+of\b/gi, "record")
    .replace(
      /\btrack\s+(?:the\s+)?(?:reps|rounds|counts|time|progress)\b/gi,
      "record counts",
    )
    .replace(/\bwall[ -]clock\b/gi, "clock");
  const patterns: Partial<Record<Feature, RegExp>> = {
    track: /\btrack\b|\b400[ -]?(?:m|meter|metre)\s+(?:oval|lap)/i,
    stairs: /\bstairs?\b|\bbleachers?\b|\bstaircase\b|\bstep[ -]?ups?\b/i,
    parkingLot: /\bparking\s+lot\b|\bcar\s+park\b/i,
    shelter: /\bshelter\b|\bpavilion\b|\bcovered\s+(?:garage|space|area)/i,
    hills: /\bhills?\b|\bincline\s+(?:run|sprint|repeat)/i,
    field: /\bgrass\b|\bturf\b|\bfield\b/i,
    pullupBars: /\bpull[ -]?ups?\b|\bchin[ -]?ups?\b|\bmonkey\s+bars?\b/i,
    benches:
      /\bbench(?:es)?\b|\bderkins?\b|\bdecline\s+(?:merkins?|push[ -]?ups?)\b|\bfeet\s+(?:elevated|on\s+a\s+raised)/i,
    walls: /\bwall\b|\bballs\s+to\s+the\s+wall\b/i,
    runningRoute:
      /\b(?:measured|marked|known)\s+(?:running\s+)?(?:loop|route)\b|\b(?:lake|trail)\s+(?:loop|route)/i,
  };
  return (Object.keys(patterns) as Feature[]).filter((f) =>
    patterns[f]!.test(text),
  );
}
export function blockedFeatures(
  plan: Parameters<typeof detectFeatures>[0] & { requiredFeatures?: Feature[] },
  context: ReturnType<typeof siteContext>,
) {
  return [
    ...new Set([...(plan.requiredFeatures ?? []), ...detectFeatures(plan)]),
  ].filter((f) => context.features[f] !== "available");
}
export function describeSite(context: ReturnType<typeof siteContext>) {
  return [
    `AO: ${context.ao || "Not specified"}`,
    `Available: ${context.available.map((f) => FEATURES[f]).join(", ") || "no fixed features confirmed"}`,
    context.unavailable.length
      ? `Unavailable: ${context.unavailable.map((f) => FEATURES[f]).join(", ")}`
      : "",
    context.sourceUrl
      ? `Website: ${context.sourceUrl} (reviewed ${context.reviewedAt})`
      : "No regional terrain source matched.",
    Object.keys(context.qStatements).length
      ? `Q statements: ${Object.entries(context.qStatements)
          .map(([key, state]) => FEATURES[key as Feature] + " " + state)
          .join(", ")}`
      : "",
    context.todayNotes ? `For this Q: ${context.todayNotes}` : "",
    "Unlisted features remain unknown.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1600);
}
