import { useEffect, useRef, useState } from "react";
import { workoutSchema, type Workout } from "./model";
import {
  cloudKey,
  cloudRequest,
  mergeCloud,
  CloudSnapshotError,
  cloudConnection,
} from "./cloud";
import { accountRequest } from "./auth";
import { isStaging } from "./environment";
export const SYNC_SETTINGS = "fe-sync:v1";
type Settings = { code: string; base: Workout[] };
function readSettings(key: string, owner?: string): Settings | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      raw &&
      (owner ? raw.code === owner : /^[a-f0-9]{64}$/.test(raw.code)) &&
      Array.isArray(raw.base)
    )
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
  owner?: string,
) {
  const settingsKey = owner
    ? `fe-account-sync:${isStaging() ? "staging:" : ""}${owner}:v1`
    : isStaging()
      ? "fe-sync:staging:v1"
      : SYNC_SETTINGS;
  const [config, setConfig] = useState(() => readSettings(settingsKey, owner));
  const [status, setStatus] = useState("Workouts save automatically");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<unknown>(null);
  const [wake, setWake] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [settingsRecovery, setSettingsRecovery] = useState<string | null>(null);
  const refreshSerial = useRef(0);
  const live = useRef({ workouts, onMerge, blocked, config });
  live.current = { workouts, onMerge, blocked, config };
  const active = useRef(false),
    abort = useRef<AbortController | null>(null);
  const acknowledged = useRef<string | null>(null),
    failed = useRef<string | null>(null);
  const epoch = useRef(0);
  const available = !!cloudConnection();
  const signature = JSON.stringify(workouts);
  const request: typeof cloudRequest = owner
    ? (_code, op, version, items, signal) =>
        accountRequest(owner, op, version, items, signal)
    : cloudRequest;
  async function sync() {
    const {
      config: current,
      workouts: captured,
      blocked: locked,
    } = live.current;
    if (!current || !available || locked || active.current) return;
    const seq = ++epoch.current;
    const capturedText = JSON.stringify(captured);
    const beganAtRefresh = refreshSerial.current;
    active.current = true;
    setBusy(true);
    setStatus("Saving to cloud…");
    setRecovery(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const remote = await request(
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
          : await request(
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
      failed.current =
        refreshSerial.current === beganAtRefresh ? capturedText : null;
      if (error instanceof CloudSnapshotError) setRecovery(error.snapshot);
      setStatus(
        error instanceof TypeError
          ? "Saved on this device · waiting to upload when connected."
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
  // Saving online is the default. Create a private collection only when a workout exists.
  useEffect(() => {
    if (config || (!owner && !workouts.length) || blocked || !available) return;
    try {
      const raw = localStorage.getItem(settingsKey);
      const existing = readSettings(settingsKey, owner);
      if (raw !== null && !existing) {
        setSettingsRecovery(raw);
        setStatus("Saved on this device · cloud recovery needs attention");
        return;
      }
      // Another tab may have initialized the collection since this render.
      const next = existing ?? { code: owner ?? cloudKey(), base: [] };
      localStorage.setItem(settingsKey, JSON.stringify(next));
      setConfig(next);
    } catch {
      setStatus(
        "Saved on this device · could not prepare automatic cloud saving",
      );
    }
  }, [
    config,
    owner,
    signature,
    workouts.length,
    blocked,
    available,
    settingsKey,
    wake,
  ]);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    if (
      !config ||
      !available ||
      !online ||
      blocked ||
      busy ||
      signature === acknowledged.current ||
      signature === failed.current
    )
      return;
    const id = setTimeout(() => void syncRef.current(), 800);
    return () => clearTimeout(id);
  }, [signature, config?.code, available, online, blocked, busy, wake]);
  useEffect(() => {
    const refresh = () => {
      refreshSerial.current++;
      setOnline(navigator.onLine !== false);
      acknowledged.current = null;
      failed.current = null;
      setWake((value) => value + 1);
    };
    const offline = () => setOnline(false);
    window.addEventListener("offline", offline);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      epoch.current++;
      abort.current?.abort();
    };
  }, []);
  function restore(code: string) {
    if (owner) return;
    if (!/^[a-f0-9]{64}$/.test(code)) {
      setStatus("Enter the full recovery code.");
      return;
    }
    if (!available || active.current) return;
    const next = { code, base: [] };
    try {
      if (settingsRecovery !== null)
        localStorage.setItem(`${settingsKey}:recovery`, settingsRecovery);
      localStorage.setItem(settingsKey, JSON.stringify(next));
      setSettingsRecovery(null);
      acknowledged.current = null;
      failed.current = null;
      setConfig(next);
      setStatus("Restoring saved workouts…");
    } catch {
      setStatus(
        "Recovery code could not be saved. Your workouts remain on this device.",
      );
    }
  }
  return {
    config,
    available,
    status: blocked
      ? "Cloud saving paused · finish editing or resolve this device’s storage warning"
      : settingsRecovery !== null
        ? status
        : !workouts.length && !config
          ? status
          : !online
            ? "Saved on this device · will upload when connected"
            : !available
              ? "Saved on this device · cloud saving is unavailable"
              : config &&
                  signature !== acknowledged.current &&
                  signature !== failed.current
                ? "Saving to cloud…"
                : status,
    busy,
    recovery,
    restore,
    settingsRecovery,
    needsRetry: failed.current === signature,
    retry: () => {
      failed.current = null;
      acknowledged.current = null;
      setWake((value) => value + 1);
    },
  };
}
