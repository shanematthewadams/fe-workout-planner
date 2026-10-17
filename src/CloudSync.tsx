import { useEffect, useRef, useState } from "react";
import type { Workout } from "./model";
import { workoutSchema } from "./model";
import {
  cloudKey,
  cloudRequest,
  mergeCloud,
  CloudSnapshotError,
} from "./cloud";
import { importStudio } from "./studio/import";
const SETTINGS = "fe-sync:v1";
type Settings = { code: string; base: Workout[] };
function settings(): Settings | null {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS) ?? "null");
    if (s && /^[a-f0-9]{64}$/.test(s.code) && Array.isArray(s.base))
      return {
        code: s.code,
        base: s.base.map((w: unknown) => workoutSchema.parse(w)),
      };
  } catch {
    /* Never replace unreadable sync settings automatically. */
  }
  return null;
}
export function CloudSync({
  workouts,
  onMerge,
  onStudio,
}: {
  workouts: Workout[];
  onMerge: (w: Workout[]) => boolean;
  onStudio: (w: Workout[]) => boolean;
}) {
  const [config, setConfig] = useState(settings),
    [recovery, setRecovery] = useState<unknown>(null),
    [code, setCode] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const live = useRef(workouts);
  live.current = workouts;
  const sequence = useRef(0),
    abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      sequence.current++;
      abort.current?.abort();
    },
    [],
  );
  async function sync(current = config) {
    if (!current) return;
    const seq = ++sequence.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const captured = JSON.stringify(workouts);
    setBusy(true);
    setMessage("Syncing…");
    setRecovery(null);
    try {
      const remote = await cloudRequest(
        current.code,
        "get",
        0,
        [],
        controller.signal,
      );
      if (seq !== sequence.current) return;
      const merged = mergeCloud(current.base, workouts, remote.workouts);
      if (JSON.stringify(live.current) !== captured)
        throw Error(
          "Plans changed while syncing. Sync again to include your latest edits.",
        );
      const next = await cloudRequest(
        current.code,
        "put",
        remote.version,
        merged.workouts,
        controller.signal,
      );
      if (seq !== sequence.current) return;
      if (JSON.stringify(live.current) !== captured)
        throw Error(
          "Plans changed while syncing. Cloud has a safe snapshot; sync again for your latest edits.",
        );
      if (!onMerge(next.workouts))
        throw Error(
          "Cloud snapshot saved, but local storage could not be updated. Export your local backup before retrying.",
        );
      const nextConfig = { code: current.code, base: next.workouts };
      localStorage.setItem(SETTINGS, JSON.stringify(nextConfig));
      setConfig(nextConfig);
      setMessage(
        `Synced ${next.workouts.length} plans.${merged.conflicts ? " Conflicting edits were kept as separate copies." : ""}`,
      );
    } catch (e) {
      if (seq === sequence.current && e instanceof CloudSnapshotError)
        setRecovery(e.snapshot);
      if (seq === sequence.current)
        setMessage(
          e instanceof Error
            ? e.message
            : "Could not sync. Local plans are safe.",
        );
    } finally {
      if (seq === sequence.current) setBusy(false);
    }
  }
  function connect(value: string) {
    if (!/^[a-f0-9]{64}$/.test(value)) {
      setMessage("Enter the full 64-character sync code.");
      return;
    }
    const next = { code: value, base: [] };
    try {
      localStorage.setItem(SETTINGS, JSON.stringify(next));
      setConfig(next);
      setCode("");
      setMessage(
        "Connected. Sync now to merge this device with your cloud plans.",
      );
    } catch {
      setMessage("Browser storage is unavailable; cloud setup was not saved.");
    }
  }
  async function importSavedStudio() {
    setBusy(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL,
        key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw Error("Cloud connection not configured.");
      const r = await fetch(
        new URL("/rest/v1/beatdowns?select=data&limit=200", url),
        { headers: { apikey: key }, signal: AbortSignal.timeout(10000) },
      );
      if (!r.ok) throw Error("Studio cloud plans are unavailable.");
      const rows: unknown = await r.json();
      if (!Array.isArray(rows)) throw Error("Invalid Studio records.");
      const converted = rows.map((row) => importStudio(row.data));
      if (!converted.length) {
        setMessage("No saved Studio cloud plans found.");
        return;
      }
      if (onStudio(converted))
        setMessage(
          `Imported ${converted.length} Studio cloud plans as local copies. Original cloud records stay unchanged.`,
        );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not import Studio plans.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cloud-sync" aria-label="Cloud sync">
      <h2>Keep your plans with you.</h2>
      <p>
        Save locally for the park. Sync when connected. Use the same private
        sync code on your phone and Mac; no signup needed. Anyone with the code
        can access and change those cloud plans.
      </p>
      <div className="actions">
        {config ? (
          <>
            <button disabled={busy} onClick={() => void sync()}>
              {busy ? "Syncing…" : "Sync now"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                const blob = new Blob([config.code + "\n"], {
                    type: "text/plain",
                  }),
                  url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "fe-private-sync-code.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download private sync code
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Disconnect this device? Keep your sync code to reconnect. Local plans stay here.",
                  )
                ) {
                  localStorage.removeItem(SETTINGS);
                  setConfig(null);
                  setMessage("Disconnected. Local plans are unchanged.");
                }
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button disabled={busy} onClick={() => connect(cloudKey())}>
            Enable cloud sync
          </button>
        )}
        <button disabled={busy} onClick={() => void importSavedStudio()}>
          Import saved Studio cloud plans
        </button>
      </div>
      {recovery !== null && (
        <button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(recovery, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "fe-cloud-recovery.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Download cloud recovery file
        </button>
      )}
      <p className="muted">
        Workout backups include saved plans and favorites. AO notes have their
        own export in the AO Directory. The current builder and timer are
        recovered on this device.
      </p>
      {!config && (
        <details>
          <summary>Connect another device</summary>
          <label>
            Private sync code
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
          </label>
          <button onClick={() => connect(code)}>Connect with code</button>
        </details>
      )}
      <p aria-live="polite">
        {message ||
          (config
            ? "Cloud connected. Sync after changes and before changing devices."
            : "Local saves work without cloud sync.")}
      </p>
    </section>
  );
}
