import { useEffect, useState } from "react";
import { z } from "zod";
import {
  codexEntryURL,
  codexReferenceSchema,
  searchCodex,
  type CodexReference,
} from "./codex-reference";
const wire = z.object({
  version: z.literal(1),
  source: z.enum(["database", "unavailable"]),
  reference: codexReferenceSchema.nullable(),
});
let saved: { expires: number; value: CodexReference } | undefined;
let pending: Promise<CodexReference | null> | undefined;
export function clearCodexCache() {
  saved = undefined;
  pending = undefined;
}
export async function loadCodexReference(): Promise<CodexReference | null> {
  if (saved && saved.expires > Date.now()) return saved.value;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch("/api/codex", {
        signal: AbortSignal.timeout(6000),
        redirect: "error",
      });
      if (!response.ok) return null;
      const data = wire.parse(await response.json());
      if (data.source !== "database" || !data.reference) return null;
      saved = { expires: Date.now() + 60000, value: data.reference };
      return data.reference;
    } catch {
      return null;
    }
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
export function CodexReferenceBrowser({ query }: { query: string }) {
  const [reference, setReference] = useState<CodexReference | null>(null);
  const [status, setStatus] = useState("loading");
  const [tag, setTag] = useState("All");
  const [limit, setLimit] = useState(40);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const value = await loadCodexReference();
      if (active) {
        setReference(value);
        setStatus(value ? "loaded" : "unavailable");
      }
    };
    void refresh();
    const focus = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      active = false;
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  const results = reference ? searchCodex(reference, query, tag) : [];
  return (
    <section aria-label="Nation Exicon catalog">
      <p>
        Exercise descriptions, aliases and routines from{" "}
        <a
          href="https://codex.f3nation.com/exicon"
          target="_blank"
          rel="noreferrer"
        >
          F3 Nation · F3 Codex ↗
        </a>
        . Confirm local variations, counting and access before leading.
      </p>
      {status === "loading" && <p role="status">Loading the Nation Exicon…</p>}
      {status === "unavailable" && (
        <p role="status">
          The Nation catalog is unavailable. Use the app’s Exicon tab for the
          saved planning guide.
        </p>
      )}
      {reference && (
        <>
          <label>
            Nation tag
            <select
              aria-label="Nation tag"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setLimit(40);
              }}
            >
              <option>All</option>
              {[...new Set(reference.entries.flatMap((e) => e.tags))]
                .sort()
                .map((t) => (
                  <option key={t}>{t}</option>
                ))}
            </select>
          </label>
          <p aria-live="polite">
            {results.length} of {reference.entries.length} Nation entries
          </p>
          <div className="movement-list">
            {results.slice(0, limit).map((e) => (
              <details className="movement-entry" key={e.id}>
                <summary>
                  <span className="movement-name">{e.name}</span>
                  <span className="movement-requirements">
                    {e.tags.join(" · ")}
                  </span>
                </summary>
                <div className="movement-body">
                  <p
                    style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}
                  >
                    {e.description}
                  </p>
                  {!!e.aliases.length && (
                    <p className="muted">Also called: {e.aliases.join(", ")}</p>
                  )}
                  <a
                    href={codexEntryURL(e.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View original in F3 Codex ↗
                  </a>
                </div>
              </details>
            ))}
          </div>
          {results.length > limit && (
            <button onClick={() => setLimit(limit + 40)}>
              Show 40 more entries
            </button>
          )}
          {!results.length && (
            <p>
              No Nation entries match. Try another name or clear the tag filter.
            </p>
          )}
        </>
      )}
    </section>
  );
}
