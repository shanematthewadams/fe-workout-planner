import { z } from "zod";
import { workoutSchema, copyWorkout, type Workout } from "./model";
const cloudSnapshot = z.object({
  version: z.number().int().nonnegative(),
  workouts: z.array(workoutSchema).max(200),
});
export type Snapshot = z.infer<typeof cloudSnapshot>;
export function cloudKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const same = (a: Workout | undefined, b: Workout | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);
/** Three-way merge: unchanged records follow edits/deletions; concurrent edits keep both. */
export function mergeCloud(
  base: Workout[],
  local: Workout[],
  remote: Workout[],
) {
  const b = new Map(base.map((w) => [w.id, w])),
    l = new Map(local.map((w) => [w.id, w])),
    r = new Map(remote.map((w) => [w.id, w]));
  const result: Workout[] = [];
  let conflicts = 0;
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const old = b.get(id),
      here = l.get(id),
      there = r.get(id);
    if (same(here, there)) {
      if (here) result.push(here);
      continue;
    }
    if (same(here, old)) {
      if (there) result.push(there);
      continue;
    }
    if (same(there, old)) {
      if (here) result.push(here);
      continue;
    }
    // An edit conflicts with another edit or deletion. Never discard the edited text.
    if (there) result.push(there);
    if (here) {
      const recovered = copyWorkout(here);
      recovered.title = here.title.slice(0, 140) + " · conflict copy";
      result.push(recovered);
    }
    conflicts++;
  }
  if (result.length > 200)
    throw Error(
      "Sync would exceed 200 plans. Export a backup and free space first.",
    );
  return { workouts: result, conflicts };
}
export async function cloudRequest(
  token: string,
  operation: "get" | "put",
  expected = 0,
  workouts: Workout[] = [],
  signal?: AbortSignal,
): Promise<Snapshot> {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw Error("Enter the full 64-character sync code.");
  const url = import.meta.env.VITE_SUPABASE_URL,
    key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw Error(
      "Cloud connection is not configured. Your local plans are safe.",
    );
  const response = await fetch(new URL("/rest/v1/rpc/fe_sync_plans", url), {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      sync_code: token,
      operation,
      expected_version: expected,
      payload: workouts,
    }),
    signal: AbortSignal.any([
      AbortSignal.timeout(10000),
      ...(signal ? [signal] : []),
    ]),
  });
  if (!response.ok) {
    if (response.status === 409)
      throw Error(
        "Cloud changed during sync. Try sync again; no cloud data was overwritten.",
      );
    throw Error(
      "Cloud sync unavailable. Your local plans are safe; retry when connected.",
    );
  }
  return cloudSnapshot.parse(await response.json());
}
