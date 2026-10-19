import { useEffect, useRef, useState } from "react";
import { workoutSchema, type Workout } from "./model";
import {
  cloudKey,
  cloudRequest,
  mergeCloud,
  CloudSnapshotError,
  cloudConnection,
} from "./cloud";
import { isStaging } from "./environment";
export const SYNC_SETTINGS = "fe-sync:v1";
type Settings = { code: string; base: Workout[] };
function readSettings(): Settings | null {
  try {
    const raw = JSON.parse(
      localStorage.getItem(
        isStaging() ? "fe-sync:staging:v1" : SYNC_SETTINGS,
      ) ?? "null",
    );
    if (raw && /^[a-f0-9]{64}$/.test(raw.code) && Array.isArray(raw.base))
      return {
        code: raw.code,
        base: raw.base.map((w: unknown) => workoutSchema.parse(w)),
      };
  } catch {
    /* Do not rewrite an unreadable connection. */
  }
  return null;
}
export function useCloudSave(
  workouts: Workout[],
  onMerge: (workouts: Workout[]) => boolean,
  blocked: boolean,
) {
  const [config, setConfig] = useState(readSettings);
  const [status, setStatus] = useState("Saved on this device");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<unknown>(null);
  const [wake, setWake] = useState(0);
  const live = useRef({ workouts, onMerge, blocked, config });
  live.current = { workouts, onMerge, blocked, config };
  const active = useRef(false),
    abort = useRef<AbortController | null>(null);
  const acknowledged = useRef<string | null>(null),
    failed = useRef<string | null>(null);
  const epoch = useRef(0);
  const settingsKey = isStaging() ? "fe-sync:staging:v1" : SYNC_SETTINGS;
  const available = !!cloudConnection();
  const signature = JSON.stringify(workouts);
  async function sync() {
    const {
      config: current,
      workouts: captured,
      blocked: locked,
    } = live.current;
    if (!current || !available || locked || active.current) return;
    const seq = ++epoch.current;
    const capturedText = JSON.stringify(captured);
    active.current = true;
    setBusy(true);
    setStatus("Saving to cloud…");
    setRecovery(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const remote = await cloudRequest(
        current.code,
        "get",
        0,
        [],
        controller.signal,
      );
      if (seq !== epoch.current) return;
      const merged = mergeCloud(current.base, captured, remote.workouts);
      if (
        JSON.stringify(live.current.workouts) !== capturedText ||
        live.current.blocked
      )
        throw Error(
          "Your latest changes are saved on this device. Retry cloud saving.",
        );
      const next =
        JSON.stringify(merged.workouts) === JSON.stringify(remote.workouts)
          ? remote
          : await cloudRequest(
              current.code,
              "put",
              remote.version,
              merged.workouts,
              controller.signal,
            );
      if (seq !== epoch.current) return;
      if (
        JSON.stringify(live.current.workouts) !== capturedText ||
        live.current.blocked
      )
        throw Error(
          "Your latest changes are saved on this device. Retry cloud saving.",
        );
      // Check the merge is still applicable before touching the recoverable baseline.
      if (
        JSON.stringify(next.workouts) !== capturedText &&
        !live.current.onMerge(next.workouts)
      )
        throw Error(
          "Cloud copy is safe. This device needs storage recovery before saving again.",
        );
      const nextConfig = { code: current.code, base: next.workouts };
      localStorage.setItem(settingsKey, JSON.stringify(nextConfig));
      acknowledged.current = JSON.stringify(next.workouts);
      failed.current = null;
      setConfig(nextConfig);
      setStatus(
        merged.conflicts
          ? "Saved · conflicting edits kept as separate copies"
          : "Saved to cloud",
      );
    } catch (error) {
      if (seq !== epoch.current) return;
      failed.current = capturedText;
      if (error instanceof CloudSnapshotError) setRecovery(error.snapshot);
      setStatus(
        error instanceof TypeError
          ? "Saved on this device · cloud unavailable. Retry when connected."
          : error instanceof Error
            ? error.message
            : "Saved on this device · cloud unavailable",
      );
    } finally {
      if (seq === epoch.current) {
        active.current = false;
        setBusy(false);
      }
    }
  }
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (
      !config ||
      !available ||
      blocked ||
      busy ||
      signature === acknowledged.current ||
      signature === failed.current
    )
      return;
    const id = setTimeout(() => void syncRef.current(), 800);
    return () => clearTimeout(id);
  }, [signature, config?.code, available, blocked, busy, wake]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      acknowledged.current = null;
      failed.current = null;
      setWake((value) => value + 1);
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      epoch.current++;
      abort.current?.abort();
    };
  }, []);
  function connect(code = cloudKey()) {
    if (!/^[a-f0-9]{64}$/.test(code)) {
      setStatus("Enter the full connection code.");
      return;
    }
    if (!available || active.current) return;
    const next = { code, base: [] };
    try {
      localStorage.setItem(settingsKey, JSON.stringify(next));
      acknowledged.current = null;
      failed.current = null;
      setConfig(next);
      setStatus("Connecting devices…");
    } catch {
      setStatus(
        "Connection could not be saved. Your workouts remain on this device.",
      );
    }
  }
  function disconnect() {
    if (
      !confirm(
        "Disconnect this device? Keep your connection code to reconnect. Saved workouts stay here.",
      )
    )
      return;
    epoch.current++;
    abort.current?.abort();
    active.current = false;
    try {
      localStorage.removeItem(settingsKey);
      setConfig(null);
      setBusy(false);
      acknowledged.current = null;
      failed.current = null;
      setStatus("Saved on this device");
    } catch {
      setStatus("Could not disconnect. Browser storage is unavailable.");
    }
  }
  return {
    config,
    available,
    status: blocked
      ? "Cloud saving paused · finish editing or resolve this device’s storage warning"
      : status,
    busy,
    recovery,
    connect,
    disconnect,
    retry: () => {
      failed.current = null;
      acknowledged.current = null;
      setWake((value) => value + 1);
    },
  };
}
