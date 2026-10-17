import { siteContext } from "./ao-context";
import {
  FEATURES,
  SURFACES,
  LIGHTING,
  type Feature,
  type Availability,
} from "./site-contract";
import { useState } from "react";
import { aoProfiles, exercises } from "./discovery";

const SITE_Q_KEY = "fe_ao_site_qs";
const TERRAIN_KEY = "fe_ao_terrain_overrides";
const DEFAULT_SITE_QS: Record<string, string> = {
  "fe-ao-clocktower": "Rug Burn",
  "fe-ao-gold-rush": "YHC",
  "fe-ao-baywatch": "Bacon",
  "fe-ao-dysentery": "Slapshot",
  "fe-ao-south-park": "Hotline",
};

type TerrainOverride = Partial<
  Record<Feature, { state: Availability; detail?: string }>
>;

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

  const [terrainOverrides, setTerrainOverrides] = useState<
    Record<string, TerrainOverride>
  >(() => {
    try {
      const raw = localStorage.getItem(TERRAIN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const exportAdminData = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      siteQs,
      terrainOverrides,
    };
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "f3-the-fe-ao-directory.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

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
            {adminMode ? "✓ Done Editing Admin" : "⚙️ Site Q & Terrain Admin"}
          </button>
        )}
      </div>
      {mode === "aos" && adminMode && (
        <aside className="ao-admin-banner">
          <div>
            <p>
              <strong>Site Q & Terrain Admin Active:</strong> Update the Site Q leader or verify fixed terrain features (track, stairs, shelter, hills, etc.) below. Changes save to this device.
            </p>
          </div>
          <div className="ao-admin-banner-actions">
            <button type="button" onClick={exportAdminData}>
              Export AO Updates (JSON)
            </button>
            <button
              type="button"
              className="ao-admin-reset-btn"
              onClick={() => {
                if (
                  confirm(
                    "Reset all Site Q and terrain customizations on this device back to regional defaults?",
                  )
                ) {
                  localStorage.removeItem(SITE_Q_KEY);
                  localStorage.removeItem(TERRAIN_KEY);
                  setSiteQs(DEFAULT_SITE_QS);
                  setTerrainOverrides({});
                }
              }}
            >
              Reset to Defaults
            </button>
          </div>
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
                      <div className="ao-admin-card-fields">
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
                                localStorage.setItem(
                                  SITE_Q_KEY,
                                  JSON.stringify(next),
                                );
                              } catch {
                                // ignore
                              }
                            }}
                          />
                        </label>

                        <div className="ao-admin-terrain-section">
                          <strong className="ao-admin-terrain-title">
                            Terrain & Local Features:
                          </strong>
                          <div className="admin-feature-grid">
                            {(Object.keys(FEATURES) as Feature[]).map(
                              (feature) => {
                                const current =
                                  terrainOverrides[a.id]?.[feature];
                                const state =
                                  current?.state ??
                                  a.local.features?.[feature]?.state ??
                                  "unknown";
                                const detail =
                                  current?.detail ??
                                  a.local.features?.[feature]?.detail ??
                                  "";
                                return (
                                  <div
                                    key={feature}
                                    className="admin-feature-row"
                                  >
                                    <span className="feature-name">
                                      {FEATURES[feature]}
                                    </span>
                                    <select
                                      aria-label={`${FEATURES[feature]} for ${a.name}`}
                                      value={state}
                                      onChange={(e) => {
                                        const nextState = e.target
                                          .value as Availability;
                                        const next = {
                                          ...terrainOverrides,
                                          [a.id]: {
                                            ...terrainOverrides[a.id],
                                            [feature]: {
                                              state: nextState,
                                              detail,
                                            },
                                          },
                                        };
                                        setTerrainOverrides(next);
                                        try {
                                          localStorage.setItem(
                                            TERRAIN_KEY,
                                            JSON.stringify(next),
                                          );
                                        } catch {
                                          // ignore
                                        }
                                      }}
                                    >
                                      <option value="available">Available</option>
                                      <option value="unavailable">
                                        Unavailable
                                      </option>
                                      <option value="unknown">Unknown</option>
                                    </select>
                                    <input
                                      type="text"
                                      placeholder={`Notes…`}
                                      value={detail}
                                      onChange={(e) => {
                                        const nextDetail = e.target.value;
                                        const next = {
                                          ...terrainOverrides,
                                          [a.id]: {
                                            ...terrainOverrides[a.id],
                                            [feature]: {
                                              state,
                                              detail: nextDetail,
                                            },
                                          },
                                        };
                                        setTerrainOverrides(next);
                                        try {
                                          localStorage.setItem(
                                            TERRAIN_KEY,
                                            JSON.stringify(next),
                                          );
                                        } catch {
                                          // ignore
                                        }
                                      }}
                                    />
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </div>
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
                        {(Object.keys(FEATURES) as Feature[]).map((feature) => {
                          const override = terrainOverrides[a.id]?.[feature];
                          const state = override
                            ? override.state
                            : context.features[feature];
                          const detail = override
                            ? override.detail
                            : a.local.features?.[feature]?.detail;
                          return (
                            <div key={feature}>
                              <dt>{FEATURES[feature]}</dt>
                              <dd>
                                {state === "available"
                                  ? "Available"
                                  : state === "unavailable"
                                    ? "Unavailable"
                                    : "Unknown"}
                                {detail && <p>{detail}</p>}
                              </dd>
                            </div>
                          );
                        })}
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
