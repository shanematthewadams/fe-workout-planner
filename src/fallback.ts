import { siteContext, describeSite } from "./ao-context";
import { workoutSchema } from "./model";
import { planningContext } from "./planning-details";
import {
  resolveRequest,
  type PlannerRequest,
  type PlannerResponse,
  type Plan,
} from "./planner-contract";
export const STYLES = [
  "Dora 1-2-3",
  "The 11s",
  "Four Corners",
  "Route 66",
  "Iron Hulk",
  "The Grinder",
  "Tabata",
  "Deck of Death",
  "IPC-inspired",
] as const;
export const GEAR = [
  "Coupon",
  "Ruck",
  "Cones",
  "Dumbbells / kettlebells",
] as const;
export function fallbackPlan(raw: PlannerRequest): PlannerResponse {
  const input = resolveRequest(raw),
    builder = input.builder;
  const details = planningContext(input.planning, builder);
  const wet = details.weather.some((w) => w === "Rain" || w === "Snow / ice");
  const coupon =
    input.equipment === "Coupon" ||
    (input.equipment !== "None" && /coupon|cindy|cinder/i.test(input.prompt));
  let style =
    builder?.style ??
    STYLES.find((s) => input.prompt.toLowerCase().includes(s.toLowerCase())) ??
    (/\bdora\b/i.test(input.prompt) ? "Dora 1-2-3" : "The Grinder");
  if (
    wet ||
    details.pax === 1 ||
    (details.grouping === "Individual" && style === "Dora 1-2-3")
  )
    style = "The Grinder";
  else if (details.grouping === "Partners" && !builder) style = "Dora 1-2-3";
  let running =
    input.running === "From prompt"
      ? wet || /\b(no|without|skip) running\b/i.test(input.prompt)
        ? "None"
        : "Light"
      : input.running;
  const gear =
    input.equipment === "None"
      ? []
      : [...(builder?.gear ?? []), ...(coupon ? ["Coupon"] : [])];
  const useCoupon = coupon || gear.includes("Coupon");
  const ex = (
    name: string,
    amount: string,
    instructions: string,
    unit: "reps" | "seconds" | "instructions" = "reps",
    counting: "1=1" | "time" | "not applicable" = "1=1",
  ) => ({ name, amount, unit, counting, instructions });
  const push = ex(
    wet ? "Standing air presses" : useCoupon ? "Coupon chest press" : "Merkins",
    "10",
    wet
      ? "Stand with empty hands and press upward through a comfortable range; no load. This is not equivalent to a loaded press. A full up-and-down cycle is one rep."
      : useCoupon
        ? "Lie on your back; press one intact coupon with control. Use bodyweight merkins if needed."
        : "One full push-up is one rep; elevate hands or lower knees as needed.",
  );
  const lower = ex(
    useCoupon ? "Goblet squat" : "Squat",
    "15",
    useCoupon
      ? "Hold one coupon at chest height; lower and stand with control. Bodyweight is an option."
      : "Lower hips then stand. Adjust depth and reps.",
  );
  const core = ex(
    wet ? "Standing knee drives" : "LBCs",
    "20",
    wet
      ? "Stand and bring one knee toward the opposite hand with control. Each knee drive counts once; alternate sides."
      : "Small controlled crunch; one lift and lower is one rep. Rest as needed.",
  );
  const pull = ex(
    wet
      ? "Standing W squeezes"
      : useCoupon
        ? "Coupon bent-over row"
        : "Prone W raises",
    "10",
    wet
      ? "Stand with elbows bent into a W, draw shoulder blades gently together, then release. One squeeze and release counts once."
      : useCoupon
        ? "Hinge at hips, pull coupon toward torso, lower with control."
        : "Lie face down, bend arms into a W and gently lift hands; keep neck neutral.",
  );
  const travel =
    running === "None"
      ? "Partner B marches in place for 45 seconds."
      : "Partner B walks or jogs a marked 20-meter down-and-back (10 meters each way).";
  let instructions = "",
    exercises = [push, lower, pull, core];
  if (details.focus === "Upper body")
    exercises = [
      push,
      pull,
      ex(
        "Standing air presses",
        "10",
        "Empty hands; press up and lower through a comfortable range. One up-and-down cycle counts once.",
      ),
    ];
  if (details.focus === "Lower body" || details.focus === "Legs")
    exercises = [
      lower,
      ex(
        "Reverse lunges",
        "10 each side",
        "Step back and return with control, using a comfortable range. Do ten on each side; stay in place.",
      ),
      ex(
        "Squat hold",
        "20",
        "Hold a comfortable squat for up to 20 seconds, then rest.",
        "seconds",
        "time",
      ),
    ];
  if (details.focus === "Core")
    exercises = [
      core,
      ex(
        "Standing oblique knee drives",
        "10 each side",
        "Stand tall, lift one knee toward the same-side elbow through a comfortable range. Do ten each side; no jumping.",
      ),
      ex(
        "Standing balance brace",
        "20",
        "Brace gently while standing, lift one foot slightly if comfortable, then change sides halfway. Rest as needed; no breath-holding.",
        "seconds",
        "time",
      ),
    ];
  let format: Plan["format"] = "Circuit";
  if (style === "Dora 1-2-3") {
    format = "Partner";
    exercises = [
      { ...push, amount: "100 team total" },
      { ...lower, amount: "200 team total" },
      { ...core, amount: "300 team total" },
    ];
    instructions = `Pair up; use a group of three for an odd PAX count. Partner A works; ${travel} Swap on return, continuing the shared count. Finish one exercise before the next. Stop at the time cap; reduce team totals if needed.`;
  } else if (style === "The 11s") {
    format = "11s";
    exercises = [
      { ...push, amount: "1 → 10" },
      { ...lower, amount: "10 → 1" },
    ];
    instructions = `Start with 1 ${push.name} and 10 ${lower.name}; then 2 and 9, through 10 and 1. Each round totals 11. ${running === "None" ? "Stay in place and take 20 seconds recovery between pairs." : "Walk or jog between two marked lines 10 meters apart; return after the second exercise."} Cap at the scheduled end even if unfinished.`;
  } else if (style === "Route 66") {
    format = "Ladder";
    exercises = [{ ...lower, amount: "1 through 11 = 66" }];
    instructions = `Mark 11 stops in confirmed open space; do not assume light poles. Perform 1 squat at stop 1, then 2, up to 11 (66 total). ${running === "None" ? "March in place 20 seconds between stops." : "Walk or jog 10 meters between stops."} Rest 90 seconds after a ladder. Repeat only while time remains; stop at the cap.`;
  } else if (style === "Iron Hulk") {
    format = "Ladder";
    exercises = [
      ex(
        "Merkins",
        "1 → 10",
        "Each full push-up counts once; modify on knees.",
      ),
      ex(
        "Unweighted air presses",
        "4 → 40",
        "Empty hands only; press overhead with control.",
      ),
    ];
    instructions =
      "Pair 1 merkin with 4 unweighted air presses, 2 with 8, up to 10 with 40. Ratio stays 1:4 (55 merkins and 220 air presses if complete). Take 30–60 seconds recovery between rungs; reduce range or reps. Stop at the cap. If finished early, alternate gentle marching and recovery.";
  } else if (style === "Tabata") {
    format = "Custom";
    instructions =
      "Use 20 seconds work / 10 seconds rest for eight intervals (4 minutes). Rotate through the four exercises, one per interval. Rest 1 minute after each 4-minute set. Repeat; reserve the final minute for recovery. Stop exactly at the section cap, even mid-set.";
    exercises = exercises.map((e) => ({
      ...e,
      amount: "20",
      unit: "seconds",
      counting: "time",
    }));
  } else if (style === "Four Corners") {
    format = "Stations";
    instructions = `Mark four nearby corners on confirmed level ground. Perform the listed reps at each corner. ${running === "None" ? "March in place 20 seconds between stations." : "Walk or jog between corners (Q measures the route)."} After each circuit rest 60 seconds. Repeat until the time cap; reduce reps as needed.`;
  } else if (style === "Deck of Death") {
    format = "Custom";
    instructions = `Use a shuffled deck: hearts = ${push.name}, diamonds = ${lower.name}, spades = ${pull.name}, clubs = LBCs. Number cards = face value, J/Q/K = 10, ace = 11; remove jokers. After every five cards recover 60 seconds. Stop at the cap, even if the deck is unfinished.`;
    exercises = exercises.map((e) => ({ ...e, amount: "Card value" }));
  } else if (style === "IPC-inspired") {
    format = "AMRAP";
    instructions =
      "IPC-inspired adaptation, NOT an official Iron PAX benchmark. Repeat the four exercises at a steady pace, recovering between rounds as needed. Count rounds only for personal reference. Stop at the scheduled cap. For an official benchmark use its published year/week and exact rules.";
  } else {
    instructions = `${exercises.length} stations: work 45 seconds, then recover and rotate for 15 seconds. Complete five circuits (${exercises.length * 5} minutes), then 2 minutes recovery. Repeat while time remains; stop at the section cap. Smaller groups can move through the list together.`;
    format = "Stations";
    exercises = exercises.map((e) => ({
      ...e,
      amount: "45",
      unit: "seconds",
      counting: "time",
    }));
  }
  const mainMinutes = input.strictSchedule
    ? input.mary
      ? 29
      : 35
    : input.minutes - 5 - (input.mary ? 5 : 0);
  instructions += ` ${details.groupingInstructions} ${wet ? "Use controlled standing work on checked footing and keep transitions short." : ""} ${details.light === "Dark" || details.light === "Dawn / dusk" ? "Stay together in a compact, Q-checked working area." : ""} All listed station counts are per person unless explicitly marked as a team total.`;
  const plan: Plan = {
    title: builder?.title || `${style} · draft`,
    summary:
      "An offline template draft. Review the movements and space before leading; your theme and additional requests may need manual edits.",
    equipment: [...new Set(gear)],
    running,
    format,
    sections: [
      {
        kind: "warmup",
        title: "Warm-o-Rama / COP",
        blocks: [
          {
            title: "Circle up",
            minutes: input.strictSchedule ? 8 : 5,
            instructions:
              "Demonstrate movements, warm up gradually and allow recovery. IC: Q calls 1-2-3, PAX calls the completed rep on count four; demonstrate a full cycle. Use remaining time for easy marching and transitions.",
            exercises: [
              ex(
                wet ? "Side steps" : "Side straddle hops",
                wet ? "10" : "10 IC",
                wet
                  ? "Step out and back without jumping; each complete out-and-back is one rep. Check footing and use a small range."
                  : "Step out or jump; one complete four-count cycle is one counted rep.",
                "reps",
                "1=1",
              ),
              ex(
                "Arm circles",
                "10 each direction",
                "Small controlled circles, then reverse.",
              ),
              ex("Squats", "10", "Lower and stand, using a comfortable range."),
              ex(
                "Imperial walkers",
                "10 each side",
                "Bring opposite elbow toward raised knee with control.",
              ),
            ],
          },
        ],
      },
      {
        kind: "thang",
        title: "The Thang",
        blocks: [
          { title: style, minutes: mainMinutes, instructions, exercises },
        ],
      },
      ...(input.mary
        ? [
            {
              kind: "mary" as const,
              title: "Mary / 6MOM",
              blocks: [
                {
                  title: "Closing core",
                  minutes: input.strictSchedule ? 6 : 5,
                  instructions: `Alternate 30 seconds work and 30 seconds rest between ${core.name} and ${wet ? "standing oblique knee drives" : "dead bugs"}. Repeat to the time cap; allow transitions and stop at the whistle.`,
                  exercises: [
                    {
                      ...core,
                      amount: "30",
                      unit: "seconds" as const,
                      counting: "time" as const,
                    },
                    ex(
                      wet ? "Standing oblique knee drives" : "Dead bugs",
                      "30",
                      wet
                        ? "Stand and slowly bring the knee toward the same-side elbow; alternate sides without jumping."
                        : "Lie on your back; slowly extend opposite arm and leg, alternate sides.",
                      "seconds",
                      "time",
                    ),
                  ],
                },
              ],
            },
          ]
        : []),
    ],
    notes: [
      "Template fallback; additional theme, focus and gear requests are not guaranteed. Edit the draft as needed.",
      "Q confirms available equipment, terrain, partner setup and modifications.",
      `Requested focus: ${details.focus}. ${details.groupingInstructions}`,
      `Expected conditions: ${details.weather.join(", ") || "not supplied"}; light: ${details.light}; date: ${details.date || "not supplied"}. These are Q expectations, not a live forecast.`,
      ...details.conditionsInstructions,
    ],
  };
  if (details.activity !== "Bootcamp") {
    const routeMinutes =
      input.minutes -
      (input.strictSchedule ? 2 : 0) -
      (input.mary ? (input.strictSchedule ? 6 : 5) : 0);
    const instructions = `Q confirms route and access before departure. ${details.route ? "Q-supplied route: " + details.route : "Use a Q-checked out-and-back; route unconfirmed."} ${details.distance ? "Target distance (not measured by the app): " + details.distance + "." : "Use time rather than an assumed distance."} ${details.pace || "Use a conversational effort; allow a walking option."} Turn back by halfway through the route time or earlier for the group. Regroup at turns and return together by the hard stop.`;
    running =
      details.activity === "Ruck"
        ? "None"
        : input.running === "None"
          ? "None"
          : "Moderate";
    plan.title = `${details.activity} · route draft`;
    plan.summary =
      "Q-confirmed route planning template. Check distance, access and group logistics before leading.";
    plan.format = "Custom";
    plan.running = running;
    plan.equipment = details.activity === "Ruck" ? ["Ruck"] : [];
    plan.sections = [
      {
        kind: "thang",
        title: details.activity + " route",
        blocks: [
          {
            title: "Out and back together",
            instructions,
            minutes: routeMinutes,
            exercises: [
              {
                name: details.activity,
                amount: String(routeMinutes),
                unit: "minutes",
                counting: "time",
                instructions,
              },
            ],
          },
        ],
      },
      ...plan.sections.filter(
        (section) => input.mary && section.kind === "mary",
      ),
    ];
    plan.notes.push(
      "COT and fellowship follow the physical hard stop. Optional exercise stops from your idea need manual review in this template.",
    );
  }
  const id = "template-" + crypto.randomUUID();
  const workout = workoutSchema.parse({
    schemaVersion: 1,
    id,
    title: plan.title,
    summary: plan.summary,
    kind: "personal",
    duration: input.minutes,
    equipment: plan.equipment,
    running,
    format: plan.format,
    schedule: {
      startTime: input.startTime,
      requiredFeatures: [],
      siteSummary: describeSite(
        siteContext(input.ao, input.prompt, input.site),
      ),
    },
    sections: plan.sections.map((s, si) => ({
      ...s,
      id: `s${si}`,
      blocks: s.blocks.map((b, bi) => ({
        ...b,
        id: `b${si}-${bi}`,
        exercises: b.exercises.map((e, ei) => ({
          ...e,
          id: `e${si}-${bi}-${ei}`,
        })),
      })),
    })),
    rawNotes: "",
    adaptationNotes: plan.notes.join("\n"),
    provenance: {
      status: "personal",
      label:
        "Template-generated personal draft · not AI-generated or a reviewed regional original",
      ao: input.ao || undefined,
      q: builder?.qName || undefined,
      durationBasis: "inferred",
    },
    updatedAt: new Date().toISOString(),
  });
  return {
    workout,
    plan,
    provider: "Template",
    model: "offline-v1",
    references: [],
  };
}
