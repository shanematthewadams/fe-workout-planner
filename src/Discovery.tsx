import { siteContext } from "./ao-context";
import { FEATURES, SURFACES, LIGHTING, type Feature } from "./site-contract";
import { useState } from "react";
import { aoProfiles, exercises } from "./discovery";
const SITE_Q_KEY = "fe_ao_site_qs";
const DEFAULT_SITE_QS: Record<string, string> = {
  "fe-ao-clocktower": "Rug Burn",
  "fe-ao-gold-rush": "YHC",
  "fe-ao-baywatch": "Bacon",
  "fe-ao-dysentery": "Slapshot",
  "fe-ao-south-park": "Hotline",
};

export function Discovery({
  mode,
  onAO,
}: {
  mode: "aos" | "exercises";
  onAO: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [siteQs, setSiteQs] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(SITE_Q_KEY);
      return raw ? { ...DEFAULT_SITE_QS, ...JSON.parse(raw) } : DEFAULT_SITE_QS;
    } catch {
      return DEFAULT_SITE_QS;
    }
  });

  return (
    <section
      className="discovery"
      aria-label={mode === "aos" ? "FE AO profiles" : "Exercise guide"}
    >
      <div className="discovery-header-row">
        <div>
          <h2>{mode === "aos" ? "Find your AO" : "Know the movement"}</h2>
          <p>
            {mode === "aos"
              ? "Official schedule snapshot. Check the regional site for changes. Website-described features show their source and review date. Unlisted features stay unknown; confirm today's access."
              : "Nine names checked against the Exicon CSV. These short instructions were written for this app; confirm variations and counts with your Q."}
          </p>
        </div>
        {mode === "aos" && (
          <button
            type="button"
            className={`ao-admin-toggle-btn ${adminMode ? "active" : ""}`}
            onClick={() => setAdminMode(!adminMode)}
          >
            {adminMode ? "✓ Done Editing Site Qs" : "⚙️ Site Q Admin Mode"}
          </button>
        )}
      </div>
      {mode === "aos" && adminMode && (
        <aside className="ao-admin-banner">
          <p>
            <strong>Site Q Admin Mode Active:</strong> Update the Site Q for any AO below. Changes persist on this device.
          </p>
          <button
            type="button"
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(siteQs, null, 2));
              const downloadAnchor = document.createElement("a");
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", "f3-the-fe-site-qs.json");
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
            }}
          >
            Export Site Qs (JSON)
          </button>
        </aside>
      )}
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
              .map((a) => {
                const context = siteContext(a.name);
                return (
                  <article className="card" key={a.id}>
                    <div className="card-top-row">
                      <h3>{a.name}</h3>
                      {!adminMode && (
                        <span className="site-q-pill">
                          <strong>Site Q:</strong> {siteQs[a.id] || "Open"}
                        </span>
                      )}
                    </div>
                    {adminMode && (
                      <label className="site-q-input-label">
                        Site Q Leader:
                        <input
                          type="text"
                          value={siteQs[a.id] || ""}
                          placeholder="e.g. Rug Burn"
                          onChange={(e) => {
                            const next = { ...siteQs, [a.id]: e.target.value };
                            setSiteQs(next);
                            try {
                              localStorage.setItem(SITE_Q_KEY, JSON.stringify(next));
                            } catch {
                              // ignore
                            }
                          }}
                        />
                      </label>
                    )}
                    {a.sessions.map((s) => (
                      <p key={s.day}>
                        <strong className="day-label">{s.day}</strong> ·{" "}
                        {s.time} · {s.minutes} minutes · {s.format}
                        <br />
                        {s.location}
                      </p>
                    ))}
                    <details>
                      <summary>Terrain & local details</summary>
                      <dl>
                        {(Object.keys(FEATURES) as Feature[]).map((feature) => (
                          <div key={feature}>
                            <dt>{FEATURES[feature]}</dt>
                            <dd>
                              {context.features[feature] === "available"
                                ? "Available"
                                : context.features[feature] === "unavailable"
                                  ? "Unavailable"
                                  : "Unknown"}
                              {a.local.features?.[feature]?.detail && (
                                <p>{a.local.features[feature]!.detail}</p>
                              )}
                            </dd>
                          </div>
                        ))}
                        <div>
                          <dt>Coupons stored on site</dt>
                          <dd>
                            {context.amenities.couponsOnSite === null
                              ? "Unknown"
                              : context.amenities.couponsOnSite
                                ? "Yes — confirm access and supply"
                                : "No — bring your own if needed"}
                          </dd>
                        </div>
                        <div>
                          <dt>Surface</dt>
                          <dd>{SURFACES[context.amenities.surface]}</dd>
                        </div>
                        <div>
                          <dt>Lighting</dt>
                          <dd>{LIGHTING[context.amenities.lighting]}</dd>
                        </div>
                      </dl>
                      {a.local.checkedAt && (
                        <p>Local details checked: {a.local.checkedAt}</p>
                      )}
                    </details>
                    <p className="muted">
                      Schedule checked {a.checkedAt.slice(0, 10)} · saved
                      snapshot
                    </p>
                    <a href={a.sourceUrl}>Official schedule ↗</a>
                    <button className="card-open" onClick={() => onAO(a.name)}>
                      Workouts from this AO →
                    </button>
                  </article>
                );
              })
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
