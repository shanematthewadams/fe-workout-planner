import { useState } from "react";
import { aoProfiles, exercises } from "./discovery";
export function Discovery({
  mode,
  onAO,
}: {
  mode: "aos" | "exercises";
  onAO: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <section
      className="discovery"
      aria-label={mode === "aos" ? "FE AO profiles" : "Exercise guide"}
    >
      <h2>{mode === "aos" ? "Find your AO" : "Know the movement"}</h2>
      <p>
        {mode === "aos"
          ? "Official schedule snapshot. Check the regional site for changes. Local terrain and equipment stay unknown until confirmed."
          : "Nine names checked against the Exicon CSV. These short instructions were written for this app; confirm variations and counts with your Q."}
      </p>
      <label>
        Search {mode === "aos" ? "AOs" : "exercises"}
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="cards">
        {mode === "aos"
          ? aoProfiles
              .filter((a) =>
                `${a.name} ${a.sessions.map((s) => s.day + " " + s.location).join(" ")}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((a) => (
                <article className="card" key={a.id}>
                  <h3>{a.name}</h3>
                  {a.sessions.map((s) => (
                    <p key={s.day}>
                      <strong className="day-label">{s.day}</strong> · {s.time}{" "}
                      · {s.minutes} minutes · {s.format}
                      <br />
                      {s.location}
                    </p>
                  ))}
                  <details>
                    <summary>Terrain & local details</summary>
                    <dl>
                      {(
                        [
                          ["walls", "Walls"],
                          ["hills", "Hills"],
                          ["stairs", "Stairs"],
                          ["distances", "Distances"],
                          ["lighting", "Lighting"],
                          ["coupons", "Coupon availability"],
                          ["weather", "Weather alternatives"],
                        ] as const
                      ).map(([k, label]) => (
                        <div key={k}>
                          <dt>{label}</dt>
                          <dd>{a.local[k] ?? "Unknown"}</dd>
                        </div>
                      ))}
                    </dl>
                    {a.local.checkedAt && (
                      <p>Local details checked: {a.local.checkedAt}</p>
                    )}
                  </details>
                  <p className="muted">
                    Schedule checked {a.checkedAt.slice(0, 10)} · saved snapshot
                  </p>
                  <a href={a.sourceUrl}>Official schedule ↗</a>
                  <button className="card-open" onClick={() => onAO(a.name)}>
                    Workouts from this AO →
                  </button>
                </article>
              ))
          : exercises
              .filter((e) =>
                `${e.name} ${e.aliases.join(" ")}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((e) => (
                <article className="card" key={e.name}>
                  <h3>{e.name}</h3>
                  {!!e.aliases.length && (
                    <p>Also called: {e.aliases.join(", ")}</p>
                  )}
                  <p>{e.instructions}</p>
                  <p>
                    Equipment: {e.equipment}
                    <br />
                    Counting: {e.counting}
                  </p>
                  <p className="muted">
                    Checked {e.checkedAt}. {e.status}
                  </p>
                  <a href={e.sourceUrl}>Exicon source file ↗</a>
                </article>
              ))}
      </div>
      {mode === "exercises" && (
        <p>
          <a href="https://f3nation.com/exicon">Full Exicon ↗</a> ·{" "}
          <a href="https://f3nation.com/lexicon">F3 Lexicon ↗</a>
          <br />
          National descriptions are linked pending confirmation of bulk reuse
          terms.
        </p>
      )}
    </section>
  );
}
