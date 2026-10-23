import type { Workout } from "./model";
/** Private workspace ownership is separate from the original creator snapshot. */
export function attributeWorkout(
  workout: Workout,
  owner?: string,
  displayName?: string,
): Workout {
  const existing = workout.attribution;
  return JSON.parse(
    JSON.stringify({
      ...workout,
      attribution: {
        ...existing,
        ownerId: owner,
        creatorId: existing?.creatorId ?? owner,
        creatorDisplayName:
          existing?.creatorDisplayName ??
          (existing?.creatorId && existing.creatorId !== owner
            ? undefined
            : displayName),
        createdAt: existing?.createdAt ?? workout.updatedAt,
        visibility: "private",
      },
    }),
  );
}

/** Adding account metadata must not make an unchanged guest plan look new. */
export function sameGuestContent(existing: Workout, guest: Workout) {
  return (
    JSON.stringify({ ...existing, attribution: undefined }) ===
    JSON.stringify({ ...guest, attribution: undefined })
  );
}
