import type { Plan } from "../../src/planner-contract";
export const planFixture: Plan = {
  title: "Stake Your Claim",
  summary: "A coupon partner workout with a prospecting theme.",
  equipment: ["Coupon"],
  running: "Light",
  format: "Partner",
  sections: [
    {
      kind: "warmup",
      title: "Survey the Ground",
      blocks: [
        {
          title: "Prepare to work",
          minutes: 5,
          instructions:
            "Explain the circuit, then complete the movements with pauses between. Walk the working area.",
          exercises: [
            {
              name: "Squats",
              amount: "10",
              unit: "reps",
              counting: "1=1",
              instructions: "One full squat is one rep; use comfortable depth.",
            },
          ],
        },
      ],
    },
    {
      kind: "thang",
      title: "Mine the Gold",
      blocks: [
        {
          title: "Partner claim",
          minutes: 35,
          instructions:
            "Five rounds. Partner A performs 10 coupon curls while B walks a marked 20-meter out-and-back, then swap. Rest 60 seconds each round. Stop at 35 minutes, including setup and transitions.",
          exercises: [
            {
              name: "Coupon curls",
              amount: "10",
              unit: "reps",
              counting: "1=1",
              instructions:
                "Each partner does 10 per turn. Use controlled reps; reduce load or reps if needed.",
            },
          ],
        },
      ],
    },
    {
      kind: "mary",
      title: "Close the Mine",
      blocks: [
        {
          title: "Core finish",
          minutes: 5,
          instructions:
            "Four relaxed rounds with recovery and transitions. Stop at 5 minutes.",
          exercises: [
            {
              name: "Plank",
              amount: "20",
              unit: "seconds",
              counting: "time",
              instructions:
                "Hold up to 20 seconds then rest; knees down if needed.",
            },
          ],
        },
      ],
    },
  ],
  notes: [
    "Confirm coupon weight, footing and marked travel distance before leading.",
  ],
};
