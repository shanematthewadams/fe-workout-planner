import { useState } from "react";
import {
  Cloud,
  CloudCog,
  CloudUpload,
  CloudOff,
  Link2,
  Copy,
  Download,
  Unplug,
  RefreshCw,
} from "lucide-react";
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
  const save = useCloudSave(workouts, onMerge, blocked);
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
  const StatusIcon = save.busy
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
          {save.config ? save.status : "Saved on this device"}
        </span>
        <button onClick={onSettings}>
          <Link2 size={16} aria-hidden="true" />
          {save.config ? "Devices & saving" : "Connect devices"}
        </button>
      </aside>
    );
  return (
    <section className="cloud-sync" aria-label="Saving and devices">
      <h2>
        <Cloud size={26} aria-hidden="true" /> Saving & devices
      </h2>
      <p>
        Connect once. Your saved workouts update automatically across your phone
        and computer. A device copy protects your work if a connection drops.
      </p>
      {!save.available && (
        <p className="muted">
          Cloud saving is not configured. Your device saves still work.
        </p>
      )}
      <p role="status">{save.status}</p>
      {save.available && (
        <div className="actions">
          {save.config ? (
            <>
              <button disabled={save.busy || blocked} onClick={save.retry}>
                <RefreshCw size={17} aria-hidden="true" />
                Retry cloud save
              </button>
              <button
                disabled={save.busy}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(save.config!.code);
                    setMessage(
                      "Connection code copied. Keep it private; it grants access to your workouts.",
                    );
                  } catch {
                    setMessage(
                      "Clipboard unavailable. Download the connection code below.",
                    );
                  }
                }}
              >
                <Copy size={17} aria-hidden="true" />
                Copy connection code
              </button>
            </>
          ) : (
            <button
              className="create"
              disabled={blocked}
              onClick={() => save.connect()}
            >
              <Link2 size={17} aria-hidden="true" />
              Connect my devices
            </button>
          )}
        </div>
      )}
      {save.available && !save.config && (
        <details>
          <summary>Connect to my existing workouts</summary>
          <label>
            Connection code
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value.trim())}
            />
          </label>
          <button
            disabled={blocked}
            onClick={() => {
              save.connect(code);
              setCode("");
            }}
          >
            Connect with code
          </button>
        </details>
      )}
      {save.recovery !== null && (
        <button
          onClick={() => download(save.recovery, "fe-cloud-recovery.json")}
        >
          <Download size={17} aria-hidden="true" />
          Download cloud recovery file
        </button>
      )}
      <details className="advanced-saving">
        <summary>Connection & recovery options</summary>
        <p>
          Anyone with the private connection code can read and change that
          collection. Keep a copy to reconnect. Favorites and unfinished edits
          stay on this device.
        </p>
        {save.config && (
          <div className="actions">
            <button
              onClick={() =>
                download(save.config!.code + "\n", "fe-private-sync-code.txt")
              }
            >
              <Download size={17} aria-hidden="true" />
              Download connection code
            </button>
            <button onClick={save.disconnect}>
              <Unplug size={17} aria-hidden="true" />
              Disconnect this device
            </button>
          </div>
        )}
        {!isStaging() && (
          <button disabled={save.busy} onClick={() => void importSavedStudio()}>
            Import saved Studio cloud plans
          </button>
        )}
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
