import { appAuthoredMovements } from "./app-movements";
import { EXICON_DATABASE } from "./studio/reference";
import type { Feature } from "./site-contract";

// App planning conventions, not a claim that local variations are standardized.
// Keep requirements explicit: a familiar name is not proof of available terrain.
export type Movement = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  instructions: string;
  counting: string;
  equipment: string[];
  features: Feature[];
  running: boolean;
  alternative: string;
};
type Rules = Pick<
  Movement,
  "aliases" | "counting" | "equipment" | "features" | "running" | "alternative"
>;
const defaults: Rules = {
  aliases: [],
  counting:
    "State one complete rep. For IC, demonstrate the full four-count cycle; count the completed cycle on four.",
  equipment: [],
  features: [],
  running: false,
  alternative:
    "Reduce reps or range, slow the pace, or rest. Confirm a suitable option with the Q.",
};
const rules: Record<string, Partial<Rules>> = {
  "Side Straddle Hop (SSH)": {
    aliases: ["SSH", "Side Straddle Hop"],
    alternative: "Step one foot out at a time instead of jumping.",
  },
  "Carolina Dry Dock (CDD)": {
    aliases: ["CDD", "Carolina Dry Dock"],
    alternative: "Use a comfortable range or choose a knee-supported merkin.",
  },
  Merkin: {
    aliases: ["Pushup", "Push-up"],
    alternative: "Lower knees and reduce reps; keep the movement controlled.",
  },
  Derkin: {
    features: ["benches"],
    alternative:
      "Use a ground-level merkin or knee-supported merkin; no raised support needed.",
  },
  Erkin: {
    features: ["benches"],
    alternative:
      "Use a knee-supported merkin on the ground if no stable raised support is confirmed.",
  },
  Dips: {
    features: ["benches"],
    alternative: "Use a close-grip knee-supported merkin on the ground.",
  },
  "Al Gore": {
    aliases: ["Squat hold"],
    counting: "Timed hold in seconds, with a clear rest interval.",
  },
  "American Hammer": {
    aliases: ["Hammers"],
    counting:
      "Specify 1=1 or 2=1. For 2=1, a touch on each side completes one rep; demonstrate IC separately.",
  },
  Lunges: {
    aliases: ["Lunge"],
    counting:
      "Specify 1=1 (each step) or per side; never silently double the count.",
  },
  "Flutter Kick": {
    counting:
      "Specify 1=1 or 2=1 for alternating kicks, or demonstrate the complete four-count IC cycle.",
  },
  "LBC (Little Baby Crunch)": {
    aliases: ["LBC", "Little Baby Crunch", "LBCs"],
  },
  "Big Boy Sit-up": { aliases: ["Big Boy Situp", "WW1", "WWI", "World War 1"] },
  "Plank-o-Rama": {
    counting:
      "State seconds per position and total hold time; allow rest or knees down.",
  },
  "Suicide Sprints": {
    aliases: ["Shuttle sprint", "Sprint", "Shuttle run", "Mosey", "Jog", "Run"],
    running: true,
    alternative:
      "Walk a Q-marked route, or replace travel with an in-place movement when no running is requested.",
    counting:
      "State one-way and total travel distance, turns, rounds, and recovery. Do not invent a measured route.",
  },
  Blockee: {
    aliases: ["Blockees"],
    equipment: ["Coupon"],
    alternative: "Use a bodyweight step-back burpee without the jump or load.",
  },
  "Curls for the Girls": {
    aliases: ["Coupon curl", "Cindy curl"],
    equipment: ["Coupon"],
    alternative:
      "For a gear-free plan choose a different movement, such as controlled merkins; do not pretend it is an equivalent loaded curl.",
  },
  "Overhead Press (OHP)": {
    aliases: ["OHP", "Overhead press", "Coupon press"],
    equipment: ["Coupon"],
    alternative:
      "Choose controlled merkins for a gear-free plan; omit overhead loading.",
  },
  "Kettlebell Swing (Cindy Swing)": {
    aliases: ["Kettlebell swing", "Cindy swing", "Coupon swing"],
    equipment: ["Weight"],
    alternative:
      "Use a bodyweight good morning with a controlled hinge; no block swing.",
  },
  "Chest Press with Cindy": {
    aliases: ["Coupon chest press", "Chest press"],
    equipment: ["Coupon"],
    alternative: "Use ground-level merkins or knee-supported merkins.",
  },
  "Farmer Carry": {
    aliases: ["Farmers carry", "Farmer's carry", "Farmer carries"],
    equipment: ["Weight"],
    alternative:
      "Walk unloaded, or choose an in-place squat hold when travel is not suitable.",
    counting:
      "State distance per leg, total distance, and whether one or two weights are used.",
  },
};
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const movements: Movement[] = EXICON_DATABASE.map((entry) => {
  const policy = rules[entry.name] ?? {};
  const aliases = [
    ...new Set([
      entry.name.replace(/\s*\(.*?\)/g, ""),
      ...(entry.aka?.split(/\s*\/\s*/) ?? []),
      ...(policy.aliases ?? []),
    ]),
  ];
  return {
    ...defaults,
    ...policy,
    id: normalize(entry.name).replaceAll(" ", "-"),
    name: entry.name,
    aliases,
    category: entry.category,
    instructions: entry.description,
    equipment:
      policy.equipment ??
      (entry.category === "Coupon / Cindy" ? ["Coupon"] : []),
    counting:
      policy.counting ??
      (entry.defaultCadence === "Timed"
        ? "Timed hold: state seconds per position and rest."
        : defaults.counting),
  };
});
// Preserve the original IDs, values and ordering of the app-written additions.
movements.push(...appAuthoredMovements);

export function searchMovements(query: string) {
  const words = normalize(query).split(" ").filter(Boolean);
  return movements.filter((m) => {
    const text = normalize(
      [m.name, ...m.aliases, m.category, ...m.equipment, ...m.features].join(
        " ",
      ),
    );
    return words.every((word) => text.includes(word));
  });
}

// Word boundaries and simple plural handling: BOR is not found inside "boring".
// This supplements direction checks; an unrecognized name is NOT declared safe.
const patterns = movements.map((movement) => ({
  movement,
  aliases: [
    ...new Set([movement.name, ...movement.aliases].map(normalize)),
  ].map((phrase) => new RegExp(`(?:^| )(${phrase}s?)(?= |$)`, "g")),
}));
export function mentionedMovements(text: string) {
  const normalized = normalize(text).replace(
    /\b(?:running|run)(?: the)? (?:clock|time|timer|total|count)\b/g,
    "clock",
  );
  return patterns
    .filter(({ aliases }) =>
      aliases.some((pattern) => {
        for (const match of normalized.matchAll(pattern)) {
          const before = normalized.slice(0, match.index).trim();
          if (
            !/\b(?:no|without|avoid|skip|omit|instead of|replace|do not|don t)(?: (?:any|shuttle|weighted|coupon))*$/.test(
              before,
            )
          )
            return true;
        }
        return false;
      }),
    )
    .map(({ movement }) => movement);
}
