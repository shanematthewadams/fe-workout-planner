/** Curated starting points. Browsing never calls a provider or assumes AO amenities. */
export const VIBES = [
  {
    id: "together",
    title: "Work together",
    detail: "Partners and team challenges",
    icon: "group",
  },
  {
    id: "heavy",
    title: "Bring the heavy stuff",
    detail: "Coupon-focused work",
    icon: "exicon",
  },
  {
    id: "moving",
    title: "Keep us moving",
    detail: "An active, upbeat workout",
    icon: "running",
  },
  {
    id: "mix",
    title: "Mix it up",
    detail: "Variety and something unexpected",
    icon: "builder",
  },
  {
    id: "surprise",
    title: "Surprise me",
    detail: "Give me a few directions to try",
    icon: "details",
  },
] as const;
export type Vibe = (typeof VIBES)[number]["id"];
export const CONCEPTS = [
  {
    id: "buddy",
    title: "The Buddy System",
    description:
      "Share a rep ladder with a partner. Trade working and holding, then finish together.",
    prompt:
      "Partner rep ladder. One partner works while the other holds an accessible bodyweight position. Switch regularly. Explain shared counts clearly.",
    vibes: ["together", "heavy", "surprise"],
  },
  {
    id: "relay",
    title: "Your Turn, My Turn",
    description:
      "Alternate short rounds with a partner. Cheer him through his turn, then take yours.",
    prompt:
      "Partner intervals with individual rep counts. Alternate work and recovery. No equipment-dependent holds.",
    vibes: ["together", "moving"],
  },
  {
    id: "team",
    title: "Better Together",
    description:
      "Small teams chip away at a shared total. Everyone contributes at his own pace.",
    prompt:
      "Team chipper with clear shared totals and accessible modifications. Avoid competition that pressures unsafe reps.",
    vibes: ["together", "mix"],
  },
  {
    id: "ladder",
    title: "Climb the Ladder",
    description:
      "Start small, add reps each round, and see how high you can climb with good form.",
    prompt:
      "Ascending rep ladder with squat, push and core movements. Explain counting and time cap.",
    vibes: ["heavy", "mix"],
  },
  {
    id: "strength",
    title: "Slow Burn",
    description:
      "Controlled strength rounds with room to recover. Make every rep count.",
    prompt:
      "Controlled strength circuit with recovery and no speed lifting. Include bodyweight alternatives to loaded exercises.",
    vibes: ["heavy", "surprise"],
  },
  {
    id: "clock",
    title: "Beat the Clock",
    description:
      "Short work windows and clear recoveries keep the group moving together.",
    prompt:
      "Tabata-style intervals. Clear work and recovery times. Everyone stays in the same open space.",
    vibes: ["moving", "mix", "surprise"],
  },
  {
    id: "rounds",
    title: "One More Round",
    description:
      "A simple circuit you can learn once and keep moving through. Find your pace.",
    prompt:
      "Repeatable AMRAP circuit with clear reps and a firm time cap. Simple transitions.",
    vibes: ["moving"],
  },
] as const;
export function conceptsFor(vibe: Vibe) {
  return CONCEPTS.filter((concept) =>
    (concept.vibes as readonly string[]).includes(vibe),
  ).slice(0, 3);
}
