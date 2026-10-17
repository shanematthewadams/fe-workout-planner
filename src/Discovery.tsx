import { siteContext } from "./ao-context";
import {
  FEATURES,
  SURFACES,
  LIGHTING,
  type Feature,
  type Availability,
} from "./site-contract";
import { readTerrainDrafts, TERRAIN_KEY, SITE_Q_KEY } from "./ao-drafts";
import { useState } from "react";
import { aoProfiles, exercises } from "./discovery";

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
      const parsed = raw ? JSON.parse(raw) : {};
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    } catch {
      return {};
    }
  });

  const [terrainOverrides, setTerrainOverrides] =
    useState<Record<string, TerrainOverride>>(readTerrainDrafts);
  const [storageError, setStorageError] = useState("");

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
            {adminMode ? "Done editing" : "Edit local AO notes"}
          </button>
        )}
      </div>
      {mode === "aos" && adminMode && (
        <aside className="ao-admin-banner">
          <div>
            <p>
              <strong>Unpublished device notes:</strong> Your changes inform
              plans on this device. They are Q-supplied context, not verified
              regional updates. Export them for a regional administrator to
              review.
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
                  setSiteQs({});
                  setTerrainOverrides({});
                }
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </aside>
      )}
      {storageError && <p role="alert">{storageError}</p>}
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
                const context = siteContext(a.name, "", {
                  overrides: {},
                  notes: "",
                  localDraft: terrainOverrides[a.id],
                });
                return (
                  <article className="card" key={a.id}>
                    <div className="card-top-row">
                      <h3>{a.name}</h3>
                      {!adminMode && (
                        <span className="site-q-pill">
                          <strong>Site Q:</strong>{" "}
                          {siteQs[a.id]
                            ? `${siteQs[a.id]} (local, unverified)`
                            : "Unknown"}
                        </span>
                      )}
                    </div>
                    {adminMode && (
                      <div className="ao-admin-card-fields">
                        <label className="site-q-input-label">
                          Site Q (local, unverified):
                          <input
                            type="text"
                            value={siteQs[a.id] || ""}
                            placeholder="e.g. Rug Burn"
                            onChange={(e) => {
                              const next = {
                                ...siteQs,
                                [a.id]: e.target.value,
                              };
                              setSiteQs(next);
                              try {
                                localStorage.setItem(
                                  SITE_Q_KEY,
                                  JSON.stringify(next),
                                );
                              } catch {
                                setStorageError(
                                  "Could not save AO notes. Export your updates before leaving.",
                                );
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
                                          setStorageError(
                                            "Could not save AO notes. Export your updates before leaving.",
                                          );
                                        }
                                      }}
                                    >
                                      <option value="available">
                                        Available
                                      </option>
                                      <option value="unavailable">
                                        Unavailable
                                      </option>
                                      <option value="unknown">Unknown</option>
                                    </select>
                                    <input
                                      type="text"
                                      placeholder={`Notes…`}
                                      maxLength={400}
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
                                          setStorageError(
                                            "Could not save AO notes. Export your updates before leaving.",
                                          );
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
                                {override && <small>Local draft · </small>}
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
