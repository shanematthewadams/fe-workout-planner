import { type Workout, type Exercise } from "./model";
const e = (
  id: string,
  name: string,
  amount: string,
  instructions: string,
  counting: Exercise["counting"] = "total",
  unit: Exercise["unit"] = "reps",
): Exercise => ({ id, name, amount, unit, counting, instructions });
const definitions: [
  string,
  string,
  Workout["format"],
  Workout["running"],
  string[],
  string,
  Exercise[],
][] = [
  [
    "circle-up",
    "Circle up, get after it",
    "Circuit",
    "None",
    [],
    "Four rounds. Work through the list, then recover for 60 seconds. Use remaining time for a relaxed final round; stop at the time cap.",
    [
      e(
        "merkins",
        "Merkins",
        "12",
        "Push-ups; lower and press with a steady trunk.",
      ),
      e("squats", "Squats", "20", "Sit hips back, then stand tall."),
      e(
        "lunges",
        "Reverse lunges",
        "10",
        "Step back and return; 10 on each leg.",
        "per side",
      ),
      e(
        "plank",
        "Plank",
        "45",
        "Hold a steady position; knees down as needed.",
        "time",
        "seconds",
      ),
    ],
  ],
  [
    "eleven",
    "Meet in the middle",
    "11s",
    "Light",
    [],
    "Mark two lines about 20 meters apart on flat ground. Start with 1 merkin at the first line and 10 squats at the second. Travel between them; next round is 2 and 9. Continue to 10 and 1. Walk or jog. Cap at 35 minutes; finishing is optional.",
    [
      e(
        "pair",
        "Merkins + squats",
        "11",
        "Reps always total 11 per round. Each merkin and each squat is one rep.",
        "1=1",
      ),
    ],
  ],
  [
    "clock",
    "Watch the clock",
    "EMOM",
    "None",
    [],
    "Every minute on the minute, start the next exercise. Finish the reps and rest for the remainder of the minute. Repeat the five-minute rotation seven times. Reduce reps if no recovery remains.",
    [
      e("m1", "Minute 1 · merkins", "10", "Push-ups; use knees if needed."),
      e("m2", "Minute 2 · squats", "15", "Controlled bodyweight squats."),
      e(
        "m3",
        "Minute 3 · mountain climbers",
        "20",
        "Bring one knee toward chest at a time; left + right = one.",
        "2=1",
      ),
      e(
        "m4",
        "Minute 4 · plank",
        "30",
        "Hold, then recover.",
        "time",
        "seconds",
      ),
      e(
        "m5",
        "Minute 5 · recovery",
        "1",
        "Stand, walk gently, and reset.",
        "time",
        "minutes",
      ),
    ],
  ],
  [
    "steady",
    "Steady as you go",
    "AMRAP",
    "None",
    [],
    "Five 6-minute work windows, each followed by 1 minute to recover and reset. Repeat the list at a controlled pace during each window; quality reps matter more than round count.",
    [
      e("a", "Merkins", "8", "Push-ups."),
      e("b", "Squats", "16", "Bodyweight squats."),
      e(
        "c",
        "Dead bugs",
        "8",
        "On your back, extend opposite arm and leg.",
        "per side",
      ),
    ],
  ],
  [
    "ladder",
    "Up the ladder",
    "Ladder",
    "None",
    [],
    "Three 10-minute ladders with a 2-minute reset after the first and second. Allow 1 minute to explain. Start at 2 reps of each exercise, then 4, 6, and so on. Restart at 2 after each reset. Stop each ladder at its cap.",
    [
      e("a", "Merkins", "2, 4, 6…", "Add two reps each rung."),
      e("b", "Squats", "2, 4, 6…", "Match the rung."),
      e(
        "c",
        "Reverse lunges",
        "2, 4, 6…",
        "Each step is one rep; alternate legs.",
        "1=1",
      ),
    ],
  ],
  [
    "partners",
    "Better together",
    "Partner",
    "Light",
    [],
    "Pair up. Partner A works through the list while B walks or jogs a marked 40-meter out-and-back (20 meters each way). Swap on B’s return, continuing the exercise count. Aim for 100 team reps of each; then repeat at an easier pace until the 35-minute cap. No racing.",
    [
      e("a", "Team merkins", "100", "Partners share the total."),
      e("b", "Team squats", "100", "Partners share the total."),
      e(
        "c",
        "Team alternating lunges",
        "100",
        "Each step counts once toward the team total.",
        "1=1",
      ),
    ],
  ],
  [
    "stations",
    "Four corners",
    "Stations",
    "None",
    [],
    "Set four stations within walking distance. Spend 60 seconds at each, then take 30 seconds to recover and move. Five circuits take 30 minutes. Allow 5 minutes for instruction and a water/reset break halfway. Repeat controlled reps; rest as needed.",
    [
      e(
        "a",
        "Corner 1 · squats",
        "60",
        "Work at your own pace.",
        "time",
        "seconds",
      ),
      e(
        "b",
        "Corner 2 · merkins",
        "60",
        "Rest between small sets.",
        "time",
        "seconds",
      ),
      e(
        "c",
        "Corner 3 · reverse lunges",
        "60",
        "Alternate legs; each step counts once.",
        "time",
        "seconds",
      ),
      e(
        "d",
        "Corner 4 · plank",
        "60",
        "Break the hold as needed.",
        "time",
        "seconds",
      ),
    ],
  ],
  [
    "coupon",
    "Bring your block",
    "Circuit",
    "None",
    ["Coupon"],
    "Bring a suitable coupon (weighted block) for each PAX. Five rounds, allowing about 6 minutes each plus 5 minutes for demonstration and transitions. Recover between sets. Do not rush to complete all rounds.",
    [
      e(
        "a",
        "Coupon deadlifts",
        "12",
        "Set down between reps; use a comfortable range.",
      ),
      e(
        "b",
        "Coupon curls",
        "12",
        "Hold the block securely and curl with control.",
      ),
      e(
        "c",
        "Goblet squats",
        "10",
        "Hold one block close to chest; bodyweight is an option.",
      ),
      e(
        "d",
        "Farmer hold",
        "30",
        "Hold the block securely at your side or in front; no overhead work.",
        "time",
        "seconds",
      ),
    ],
  ],
  [
    "chipper",
    "One list, one crew",
    "Chipper",
    "None",
    [],
    "Work down the list once, breaking into manageable sets with recovery. Early finishers repeat the list at half the reps. Cap at 35 minutes; no need to finish.",
    [
      e("a", "Squats", "100", "Break into sets of 10–20."),
      e("b", "Merkins", "60", "Break into small sets; modify as needed."),
      e(
        "c",
        "Alternating reverse lunges",
        "80",
        "40 each leg; each step counts once.",
        "1=1",
      ),
      e("d", "Dead bugs", "30", "30 on each side.", "per side"),
    ],
  ],
  [
    "travel",
    "A little ground to cover",
    "Circuit",
    "Moderate",
    [],
    "Choose a flat, clearly marked 200-meter loop after checking the site. Five rounds: easy loop, then the exercises. Walk if preferred. Recover for 1 minute per round. Allow 35 minutes including explanation and transitions.",
    [
      e(
        "run",
        "Easy loop",
        "200",
        "Walk or jog; regroup after the loop.",
        "distance",
        "meters",
      ),
      e("a", "Merkins", "10", "Push-ups."),
      e("b", "Squats", "20", "Bodyweight squats."),
      e("c", "Plank", "30", "Knees down as needed.", "time", "seconds"),
    ],
  ],
];
export const catalog: Workout[] = definitions.map(
  ([id, title, format, running, equipment, instructions, exercises], i) => ({
    schemaVersion: 1,
    id: "fe-template-" + id,
    title,
    summary: [
      "A simple full-body beatdown with room to make it yours.",
      "Two lines. Eleven reps. A clear plan to lead.",
      "Let the clock do the counting.",
      "Find a sustainable rhythm and keep moving.",
      "Small starts. A little more each time.",
      "Share the work. Keep the crew together.",
      "Move around the circle, one minute at a time.",
      "A block, a little space, and a full-body plan.",
      "Chip away at one straightforward list.",
      "Easy miles meet simple strength.",
    ][i],
    kind: "source",
    duration: 45,
    equipment,
    running,
    format,
    sections: [
      {
        id: id + "-warm",
        kind: "warmup",
        title: "Warmup",
        blocks: [
          {
            id: id + "-wblock",
            title: "Circle up",
            instructions:
              "Allow 1 minute to explain the plan, then 4 minutes of easy movement. Demonstrate unfamiliar exercises and identify modifications.",
            minutes: 5,
            exercises: [
              e(
                "w1",
                "Side straddle hops",
                "20",
                "Jumping jacks; step out instead if preferred. Each complete jack counts once.",
                "1=1",
              ),
              e(
                "w2",
                "Arm circles",
                "10",
                "10 forward and 10 backward.",
                "per side",
              ),
              e("w3", "Easy squats", "10", "Use a comfortable range."),
              e(
                "w4",
                "Easy march",
                "1",
                "March in place for remaining warmup time.",
                "time",
                "minutes",
              ),
            ],
          },
        ],
      },
      {
        id: id + "-thang",
        kind: "thang",
        title: "The Thang",
        blocks: [
          {
            id: id + "-main",
            title: format + " plan",
            instructions,
            minutes: 35,
            exercises,
          },
        ],
      },
      ...(i === 8
        ? []
        : [
            {
              id: id + "-mary",
              kind: "mary" as const,
              title: "Mary",
              blocks: [
                {
                  id: id + "-core",
                  title: "Bring it home",
                  instructions:
                    "Allow 1 minute to explain, then two easy rounds with recovery and transitions. Stop at the session cap.",
                  minutes: 5,
                  exercises: [
                    e(
                      "mary1",
                      "Dead bugs",
                      "8",
                      "Extend opposite arm and leg, alternating.",
                      "per side",
                    ),
                    e(
                      "mary2",
                      "Plank",
                      "30",
                      "Break the hold as needed.",
                      "time",
                      "seconds",
                    ),
                  ],
                },
              ],
            },
          ]),
    ],
    rawNotes: "",
    adaptationNotes:
      i === 8
        ? "Mary omitted. The planned sections total about 40 minutes; leave 5 minutes for extra recovery or an earlier finish."
        : "All timings include explanation, recovery, and transitions. Adjust the work to your PAX and the space available.",
    provenance: {
      status: "illustrative",
      label:
        "Original illustrative template · not a regional backblast or field-tested plan",
    },
    updatedAt: "2026-10-15T17:00:00.000Z",
  }),
);
// Exercise IDs are scoped to the workout; normalize to guarantee uniqueness across its sections.
for (const w of catalog)
  for (const s of w.sections)
    for (const b of s.blocks)
      for (const x of b.exercises) x.id = `${b.id}-${x.id}`;

// Shorter sessions give the library a useful option beyond the usual 45 minutes.
const emom = catalog.find((w) => w.id === "fe-template-clock")!;
emom.duration = 30;
emom.sections[1].blocks[0].minutes = 20;
emom.sections[1].blocks[0].instructions =
  emom.sections[1].blocks[0].instructions.replace("seven times", "four times");
const circuit = catalog[0];
circuit.duration = 30;
circuit.sections[1].blocks[0].minutes = 20;
circuit.sections[1].blocks[0].instructions =
  "Allow 2 minutes to explain and demonstrate. Four rounds of about 4 minutes each, including 60 seconds of recovery after each round. Use 2 minutes to regroup and reset. Stop at 20 minutes, even if rounds are unfinished.";
