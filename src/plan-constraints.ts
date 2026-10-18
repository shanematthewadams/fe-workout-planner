import type { Plan, PlannerRequest } from "./planner-contract";

// Inspect executable directions, not summaries or disclaimer notes. Metadata
// alone cannot establish that an exercise respects the Q's restrictions.
const gear =
  /\b(?:coupons?|cind(?:y|ies)|cinder blocks?|dumbbells?|kettlebells?|rucks?|sandbags?|resistance bands?|jump ropes?|medicine balls?)\b/i;
const travel =
  /\b(?:run(?:ning)?|runs|jog(?:ging)?|jogs|sprint(?:ing)?|sprints|mosey|moseys|moseying)\b/i;
function directions(plan: Plan) {
  return plan.sections
    .flatMap((s) =>
      s.blocks.flatMap((b) => [
        b.instructions,
        ...b.exercises.map((e) => `${e.name}. ${e.instructions}`),
      ]),
    )
    .flatMap((text) => text.split(/[.!;\n]/))
    .map((text) =>
      text
        .replace(
          /\b(?:no|without|avoid|skip|omit|do not|don't)\s+(?:any\s+)?(?:running|runs?|jogging|sprints?|equipment|coupons?|cinder blocks?)\b/gi,
          "",
        )
        .replace(
          /\b(?:running|run)\s+(?:clock|time|timer|total|count)\b/gi,
          "clock",
        ),
    );
}
export function movementConflicts(plan: Plan, request: PlannerRequest) {
  const text = directions(plan);
  return [
    ...(request.running === "None" && text.some((t) => travel.test(t))
      ? ["The movements include running despite your no-running preference."]
      : []),
    ...(request.equipment === "None" && text.some((t) => gear.test(t))
      ? ["The movements require gear despite your no-equipment preference."]
      : []),
  ];
}
