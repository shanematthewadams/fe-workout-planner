import type { Plan, PlannerRequest } from "./planner-contract";
import { mentionedMovements } from "./movements";

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
          /\b(?:no|without|avoid|skip|omit|do not|don't)\s+(?:any\s+)?(?:shuttle\s+)?(?:running|runs?|jog(?:ging)?|sprint(?:ing)?s?|mosey|equipment|coupons?|cindy|cinder blocks?|dumbbells?|kettlebells?|rucks?|sandbags?|resistance bands?|jump ropes?|medicine balls?)\b/gi,
          "",
        )
        .replace(
          /\b(?:running|run)\s+(?:the\s+)?(?:clock|time|timer|total|count)\b/gi,
          "clock",
        ),
    );
}
export function movementConflicts(plan: Plan, request: PlannerRequest) {
  const text = directions(plan);
  const known = text.flatMap(mentionedMovements);
  return [
    ...(request.running === "None" &&
    (text.some((t) => travel.test(t)) || known.some((m) => m.running))
      ? ["The movements include running despite your no-running preference."]
      : []),
    ...(request.equipment === "None" &&
    (text.some((t) => gear.test(t)) || known.some((m) => m.equipment.length))
      ? ["The movements require gear despite your no-equipment preference."]
      : []),
  ];
}
