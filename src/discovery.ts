import official from "../data/ao-official.json";
import local from "../data/ao-local.json";
export type LocalAO = {
  amenities?: Partial<import("./site-contract").Amenities>;
  features?: Partial<
    Record<
      import("./site-contract").Feature,
      { state: import("./site-contract").Availability; detail?: string }
    >
  >;
  reviewBasis?: string;
  walls?: string;
  hills?: string;
  stairs?: string;
  distances?: string;
  lighting?: string;
  coupons?: string;
  weather?: string;
  checkedAt?: string;
  sourceUrl?: string;
};
export const aoProfiles = official.map((ao) => ({
  ...ao,
  local: (local as Record<string, LocalAO>)[ao.id] ?? {},
}));
export const statusLabel = (status: string) =>
  ({
    illustrative: "Illustrative starter",
    personal: "Personal draft",
    "imported-unreviewed": "Awaiting review",
    "regional-reviewed": "Reviewed FE original",
  })[status] ?? status;
export const exercises = [
  {
    name: "Al Gore",
    aliases: ["Squat hold"],
    instructions: "Hold a squat with arms forward.",
    equipment: "None",
    counting: "Time",
  },
  {
    name: "American Hammer",
    aliases: ["Russian twist"],
    instructions: "Sit, lean back and rotate hands between sides.",
    equipment: "None",
    counting: "Confirm with Q; alternating sides",
  },
  {
    name: "Burpee",
    aliases: [],
    instructions:
      "Drop to plank, perform a push-up, return to standing and jump.",
    equipment: "None",
    counting: "One complete sequence",
  },
  {
    name: "Carolina Dry Docks",
    aliases: [],
    instructions:
      "Raise hips from plank. Bend elbows, lowering head toward hands, then press up.",
    equipment: "None",
    counting: "One lower and press",
  },
  {
    name: "Derkin",
    aliases: ["Decline merkin"],
    instructions: "Elevate feet on a stable surface and perform a push-up.",
    equipment: "Stable raised surface",
    counting: "One push-up",
  },
  {
    name: "Dips",
    aliases: [],
    instructions:
      "Use a stable support behind you. Bend elbows to lower, then press up.",
    equipment: "Stable support",
    counting: "One lower and press",
  },
  {
    name: "Flutter kicks",
    aliases: [],
    instructions: "Lie back, lift legs and alternate small kicks.",
    equipment: "None",
    counting: "Confirm with Q; alternating legs",
  },
  {
    name: "LBCs",
    aliases: ["Little baby crunch"],
    instructions:
      "Lie back with bent knees. Lift shoulders toward knees, then lower.",
    equipment: "None",
    counting: "Confirm cadence or single reps with Q",
  },
  {
    name: "Mountain Climbers",
    aliases: [],
    instructions: "From plank, alternate driving knees forward.",
    equipment: "None",
    counting: "Confirm with Q; alternating legs",
  },
].map((e) => ({
  ...e,
  sourceUrl: "https://github.com/F3-Nation/the-codex/blob/main/exicon.csv",
  checkedAt: "2026-10-16",
  status:
    "Name verified in Exicon CSV; instructions written for this app. Regional counting may differ.",
}));
