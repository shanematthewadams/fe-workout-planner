import type { Movement } from "./movements";
// These eight descriptions were written for this application in f892bb3.
// Kept separate from the bundled third-party reference text for source review.
export const appAuthoredMovements: Movement[] = [];
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
function add(
  name: string,
  category: string,
  instructions: string,
  policy: Partial<Rules> = {},
) {
  appAuthoredMovements.push({
    ...defaults,
    ...policy,
    id: normalize(name).replaceAll(" ", "-"),
    name,
    category,
    instructions,
  });
}
add(
  "Squat",
  "Lower Body",
  "Stand tall, bend knees and hips through a comfortable range, then stand.",
  {
    aliases: ["Squats", "Air squat"],
    counting: "One lower-and-stand cycle is one rep.",
  },
);
add(
  "Plank",
  "Core / Mary",
  "Hold a straight, supported position on hands or forearms; lower knees or rest as needed.",
  { counting: "Timed hold in seconds; include rest." },
);
add(
  "Mountain Climber",
  "Core / Mary",
  "From a supported plank, alternate driving knees forward at a controlled pace.",
  {
    aliases: ["Mountain Climbers"],
    counting:
      "Specify 1=1 (each knee drive), 2=1 (both sides), or demonstrate the four-count IC cycle.",
  },
);
add(
  "Bent-over Row",
  "Coupon / Cindy",
  "Hinge with a controlled back position, draw the weight toward the torso, then lower.",
  { aliases: ["BOR", "Coupon row", "Bent over rows"], equipment: ["Coupon"] },
);
add(
  "WW3",
  "Coupon / Cindy",
  "In this app: a sit-up followed by an overhead coupon press; explain and demonstrate before starting.",
  {
    aliases: ["WWIII", "World War 3"],
    equipment: ["Coupon"],
    counting: "One complete sit-up-and-press sequence is one rep.",
    alternative:
      "Use an unweighted sit-up without the overhead press. Confirm local WW3 variations.",
  },
);
add(
  "Thruster",
  "Coupon / Cindy",
  "Squat with the weight held at the chest, stand, then press overhead with control.",
  {
    aliases: ["Thrusters", "Coupon thruster"],
    equipment: ["Weight"],
    alternative: "Use a bodyweight squat and omit the overhead load.",
  },
);
add(
  "Wall Sit",
  "Lower Body",
  "Use a confirmed suitable wall for a supported squat hold.",
  {
    aliases: ["People's chair", "Peoples chair"],
    features: ["walls"],
    counting: "Timed hold with rest.",
    alternative: "Use an unsupported Al Gore squat hold; no wall required.",
  },
);
add(
  "Pull-up",
  "Upper Body",
  "Use confirmed suitable pull-up bars; pull and lower with control.",
  {
    aliases: ["Pullup", "Pullups", "Pull-ups"],
    features: ["pullupBars"],
    alternative:
      "Choose a ground-level merkin when no bars or portable gear are available; it is a different movement.",
  },
);
