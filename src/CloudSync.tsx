import { useState } from "react";
import {
  Cloud,
  CloudCog,
  CloudUpload,
  CloudOff,
  Link2,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react";
import { useAccount } from "./AccountContext";
import { useCloudSave } from "./useCloudSave";
import { isStaging } from "./environment";
import { importStudio } from "./studio/import";
import type { Workout } from "./model";
export function CloudSync({
  workouts,
  onMerge,
  onStudio,
  compact = false,
  hidden = false,
  blocked = false,
  onSettings,
}: {
  workouts: Workout[];
  onMerge: (workouts: Workout[]) => boolean;
  onStudio: (workouts: Workout[]) => boolean;
  compact?: boolean;
  hidden?: boolean;
  blocked?: boolean;
  onSettings?: () => void;
}) {
  const account = useAccount();
  const owner = account?.user?.id;
  const save = useCloudSave(
    workouts,
    onMerge,
    blocked || !!account?.switching,
    owner,
  );
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const download = (value: unknown, name: string) => {
    const url = URL.createObjectURL(
      new Blob(
        [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function importSavedStudio() {
    if (isStaging()) return;
    try {
      const url = import.meta.env.VITE_SUPABASE_URL,
        key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw Error("Cloud connection is not configured.");
      const response = await fetch(
        new URL("/rest/v1/beatdowns?select=data&limit=200", url),
        { headers: { apikey: key }, signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw Error("Studio cloud plans are unavailable.");
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw Error("Invalid Studio records.");
      const converted = rows.map((row) => importStudio(row.data));
      if (!converted.length) setMessage("No Studio plans found.");
      else if (onStudio(converted))
        setMessage(`Imported ${converted.length} personal copies.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not import Studio plans.",
      );
    }
  }
  if (hidden) return null;
  const StatusIcon =
    save.busy || save.status.startsWith("Saving to cloud")
      ? CloudUpload
      : save.config && save.status.startsWith("Saved to cloud")
        ? CloudCog
        : save.config
          ? CloudOff
          : Cloud;
  if (compact)
    return (
      <aside className="cloud-statusbar no-print" aria-label="Saving status">
        <span>
          <StatusIcon size={17} aria-hidden="true" />
          {save.status}
        </span>
        <button onClick={onSettings}>
          <Link2 size={16} aria-hidden="true" />
          Saving details
        </button>
      </aside>
    );
  return (
    <section className="cloud-sync" aria-label="Saving and recovery">
      <h2>
        <Cloud size={26} aria-hidden="true" /> Saving & recovery
      </h2>
      <p>
        Workouts save online automatically. When you’re offline, changes stay on
        this device and upload when you’re connected again.
      </p>
      {!save.available && (
        <p className="muted">
          Cloud saving is not configured. Your device saves still work.
        </p>
      )}
      <p role="status">{save.status}</p>
      {save.available && save.config && save.needsRetry && (
        <button disabled={save.busy || blocked} onClick={save.retry}>
          <RefreshCw size={17} aria-hidden="true" /> Retry saving
        </button>
      )}
      {save.recovery !== null && (
        <button
          onClick={() => download(save.recovery, "fe-cloud-recovery.json")}
        >
          <Download size={17} aria-hidden="true" />
          Download cloud recovery file
        </button>
      )}
      {save.settingsRecovery !== null && (
        <button
          onClick={() =>
            download(save.settingsRecovery, "fe-saving-settings-recovery.json")
          }
        >
          <Download size={17} aria-hidden="true" /> Download recovery settings
        </button>
      )}
      {owner ? (
        <p>
          Sign in with the same email on another device to open your account
          workouts. Favorites and unfinished edits stay on this browser.
        </p>
      ) : (
        <details className="advanced-saving">
          <summary>Recovery & another device</summary>
          <p>
            Saving needs no setup. To open the same private workouts on another
            device, copy your recovery code there. Keep it private: anyone with
            this code can read and change those workouts. Favorites and
            unfinished edits stay on this device.
          </p>
          {save.config && (
            <div className="actions">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(save.config!.code);
                    setMessage(
                      "Recovery code copied. Keep it private; it grants access to your workouts.",
                    );
                  } catch {
                    setMessage(
                      "Clipboard unavailable. Download the recovery code instead.",
                    );
                  }
                }}
              >
                <Copy size={17} aria-hidden="true" /> Copy recovery code
              </button>
              <button
                onClick={() =>
                  download(
                    save.config!.code + "\n",
                    "fe-private-recovery-code.txt",
                  )
                }
              >
                <Download size={17} aria-hidden="true" /> Download recovery code
              </button>
            </div>
          )}
          {save.available && (
            <details>
              <summary>Use an existing recovery code</summary>
              <label>
                Recovery code
                <input
                  type="password"
                  autoComplete="off"
                  value={code}
                  onChange={(event) => setCode(event.target.value.trim())}
                />
              </label>
              <button
                disabled={save.busy || blocked}
                onClick={() => {
                  save.restore(code);
                  setCode("");
                }}
              >
                Restore workouts
              </button>
            </details>
          )}
          {!isStaging() && (
            <button
              disabled={save.busy}
              onClick={() => void importSavedStudio()}
            >
              Import saved Studio cloud plans
            </button>
          )}
        </details>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
