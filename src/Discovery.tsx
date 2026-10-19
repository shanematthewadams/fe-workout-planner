import { NationLocation } from "./NationLocation";
import { AppIcon } from "./AppIcon";
import { AOReview } from "./AOReview";
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
import { aoProfiles } from "./discovery";
import { MovementGuide } from "./MovementGuide";

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
  return mode === "exercises" ? (
    <MovementGuide searchLabel="Search exercises" />
  ) : (
    <AODirectory onAO={onAO} />
  );
}

function AODirectory({ onAO }: { onAO: (name: string) => void }) {
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
    <section className="discovery" aria-label="FE AO profiles">
      <div className="discovery-header-row">
        <div>
          <h2>
            <AppIcon name="aos" size={25} />
            Find your AO
          </h2>
          <p>
            Official schedule snapshot. Check the regional site for changes.
            Website-described features show their source and review date.
            Unlisted features stay unknown; confirm today’s access.
          </p>
        </div>
        <button
          type="button"
          className={`ao-admin-toggle-btn ${adminMode ? "active" : ""}`}
          onClick={() => setAdminMode(!adminMode)}
        >
          {adminMode ? "Done editing" : "Edit local AO notes"}
        </button>
      </div>
      {adminMode && (
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
      <AOReview />
      {storageError && <p role="alert">{storageError}</p>}
      <label>
        Search AOs
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="cards">
        {aoProfiles
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
                        {(Object.keys(FEATURES) as Feature[]).map((feature) => {
                          const current = terrainOverrides[a.id]?.[feature];
                          const state =
                            current?.state ??
                            a.local.features?.[feature]?.state ??
                            "unknown";
                          const detail =
                            current?.detail ??
                            a.local.features?.[feature]?.detail ??
                            "";
                          return (
                            <div key={feature} className="admin-feature-row">
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
                                <option value="available">Available</option>
                                <option value="unavailable">Unavailable</option>
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
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {a.sessions.map((s) => (
                  <p key={s.day}>
                    <strong className="day-label">{s.day}</strong> · {s.time} ·{" "}
                    {s.minutes} minutes · {s.format}
                    <br />
                    {s.location}
                  </p>
                ))}
                <NationLocation
                  aoId={a.id}
                  seasonal={(a.local.venues?.length ?? 0) > 1}
                />
                {a.local.accessNotes && (
                  <p className="ao-access-note">
                    <AppIcon name="review" />
                    {a.local.accessNotes}
                  </p>
                )}
                {!!a.local.venues?.length && (
                  <details>
                    <summary>
                      <AppIcon name="aos" />
                      Locations & seasonal access
                    </summary>
                    {a.local.venues.map((venue) => (
                      <article key={venue.id}>
                        <h4>{venue.name}</h4>
                        <p>{venue.season}</p>
                        <p>{venue.access}</p>
                      </article>
                    ))}
                  </details>
                )}
                {!!a.local.landmarks?.length && (
                  <details>
                    <summary>
                      <AppIcon name="landmark" />
                      Landmarks
                    </summary>
                    {a.local.landmarks.map((landmark) => (
                      <article key={landmark.name}>
                        <h4>{landmark.name}</h4>
                        <p>{landmark.description}</p>
                        <p className="muted">
                          {landmark.status} · {landmark.use} ·{" "}
                          {landmark.restrictions}
                        </p>
                      </article>
                    ))}
                  </details>
                )}
                <details>
                  <summary>
                    <AppIcon name="aos" />
                    Terrain & local details
                  </summary>
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
                  Schedule checked {a.checkedAt.slice(0, 10)} · saved snapshot
                </p>
                <a href={a.sourceUrl}>Official schedule ↗</a>
                <button className="card-open" onClick={() => onAO(a.name)}>
                  Workouts from this AO →
                </button>
              </article>
            );
          })}
      </div>
    </section>
  );
}
