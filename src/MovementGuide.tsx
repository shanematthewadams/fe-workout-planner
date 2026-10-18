import { useState } from "react";
import { movements, searchMovements } from "./movements";
import { FEATURES } from "./site-contract";

export function MovementGuide({
  query = "",
  searchLabel,
}: {
  query?: string;
  searchLabel?: string;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [requirements, setRequirements] = useState("All");
  const results = searchMovements(searchLabel ? localQuery : query).filter(
    (m) =>
      (category === "All" || m.category === category) &&
      (requirements === "All" ||
        (requirements === "Bodyweight, no fixed support"
          ? !m.equipment.length && !m.features.length
          : requirements === "Portable gear"
            ? m.equipment.length
            : m.features.length)),
  );
  return (
    <section className="movement-guide" aria-label="Movement catalog">
      {searchLabel && (
        <>
          <h2>Know the movement</h2>
          <label>
            {searchLabel}
            <input
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
            />
          </label>
        </>
      )}
      <p className="muted">
        App planning guide, not a verified regional standard. Names, variations,
        and counts can differ. Demonstrate the movement before leading.
      </p>
      <div className="movement-filters">
        <label>
          Movement category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>All</option>
            {[...new Set(movements.map((m) => m.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Movement requirements
          <select
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
          >
            {[
              "All",
              "Bodyweight, no fixed support",
              "Portable gear",
              "Fixed support",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <p aria-live="polite">
        {results.length} {results.length === 1 ? "movement" : "movements"}
      </p>
      <div className="movement-list">
        {results.map((m) => (
          <details className="movement-entry" key={m.id}>
            <summary>
              <span className="movement-name">{m.name}</span>
              <span className="movement-requirements">
                {[
                  ...m.equipment,
                  ...m.features.map((f) => FEATURES[f]),
                  ...(m.running ? ["Running"] : []),
                ].join(" · ") || "Bodyweight"}
              </span>
            </summary>
            <div className="movement-body">
              <p>{m.instructions}</p>
              {!!m.aliases.length && (
                <p className="muted">Also called: {m.aliases.join(", ")}</p>
              )}
              <p>
                <strong>Counting:</strong> {m.counting}
              </p>
              <p>
                <strong>Alternative:</strong> {m.alternative}
              </p>
              {!!m.features.length && (
                <p>
                  <strong>Confirm access:</strong>{" "}
                  {m.features.map((f) => FEATURES[f]).join(", ")}. Unknown or
                  closed support must not be assumed available.
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
      {!results.length && (
        <p>
          No movements match. Try another name or clear the category and
          requirements filters.
        </p>
      )}
      <p>
        <a
          href="https://github.com/F3-Nation/the-codex/blob/main/exicon.csv"
          target="_blank"
          rel="noreferrer"
        >
          Exicon source file ↗
        </a>{" "}
        · Confirm regional variations with your Q.
      </p>
    </section>
  );
}
