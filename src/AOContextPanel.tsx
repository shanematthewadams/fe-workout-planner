import { withLocalAO } from "./ao-drafts";
import { aoProfiles } from "./discovery";
import { siteContext, findAO } from "./ao-context";
import {
  FEATURES,
  SURFACES,
  LIGHTING,
  type Amenities,
  type Feature,
  type SiteInput,
  type Availability,
} from "./site-contract";
export function AOContextPanel({
  ao,
  onAO,
  prompt,
  startTime,
  onTime,
  site,
  onSite,
  disabled,
}: {
  ao: string;
  onAO: (v: string) => void;
  prompt: string;
  startTime: string;
  onTime: (v: string) => void;
  site: SiteInput;
  onSite: (v: SiteInput) => void;
  disabled: boolean;
}) {
  const context = siteContext(ao, prompt, withLocalAO(ao, prompt, site)),
    profile = findAO(ao, prompt);
  return (
    <section className="ao-context" aria-label="Where and when">
      <div className="ao-start-row">
        <label>
          Where are you leading?
          <input
            aria-label="Q location"
            list="fe-ao-options"
            placeholder="Choose an AO, or type a downrange location"
            value={ao}
            disabled={disabled}
            maxLength={160}
            onChange={(e) => onAO(e.target.value)}
          />
          <datalist id="fe-ao-options">
            {aoProfiles.map((a) => (
              <option key={a.id} value={a.name} />
            ))}
          </datalist>
        </label>
        <label>
          Start time
          <input
            type="time"
            value={startTime}
            disabled={disabled}
            onInput={(e) => onTime(e.currentTarget.value)}
            onChange={(e) => onTime(e.target.value)}
          />
        </label>
      </div>
      <p className="ao-quick-summary">
        {profile ? `${profile.name} · ` : ao ? "Custom AO · " : ""}
        {context.available.length
          ? `Available for this Q: ${context.available.map((f) => FEATURES[f]).join(", ")}.`
          : "No site features confirmed yet. A bodyweight or portable-gear plan still works."}
      </p>
      {Object.keys(context.localDraft).length > 0 && (
        <p className="ao-quick-summary">
          Includes unpublished AO notes from this device.
        </p>
      )}
      <details className="today-details">
        <summary>
          Anything different today? <span>Optional site details</span>
        </summary>
        <p>
          Change only what you know. Unknown features stay out of the plan.
          These changes apply to this workout, not the regional profile.
          Generate or refine the draft to apply them.
        </p>
        <fieldset disabled={disabled}>
          <legend>Available for this Q</legend>
          <div className="feature-grid">
            {(Object.keys(FEATURES) as Feature[]).map((feature) => (
              <label key={feature}>
                {FEATURES[feature]}
                <select
                  aria-label={`${FEATURES[feature]} today`}
                  value={site.overrides[feature] ?? ""}
                  onChange={(e) => {
                    const overrides = { ...site.overrides };
                    if (e.target.value)
                      overrides[feature] = e.target.value as Availability;
                    else delete overrides[feature];
                    onSite({ ...site, overrides });
                  }}
                >
                  <option value="">
                    Profile:{" "}
                    {
                      siteContext(
                        ao,
                        prompt,
                        withLocalAO(ao, prompt, { overrides: {}, notes: "" }),
                      ).features[feature]
                    }
                  </option>
                  <option value="available">Available today</option>
                  <option value="unavailable">Unavailable today</option>
                  <option value="unknown">Unknown today</option>
                </select>
                {profile?.local.features?.[feature]?.detail && (
                  <small>{profile.local.features[feature]!.detail}</small>
                )}
              </label>
            ))}
          </div>
          <div className="feature-grid">
            <label>
              Coupons stored on site
              <select
                aria-label="Coupons stored on site today"
                value={
                  site.amenities?.couponsOnSite === undefined
                    ? ""
                    : site.amenities.couponsOnSite === null
                      ? "unknown"
                      : String(site.amenities.couponsOnSite)
                }
                onChange={(e) => {
                  const amenities = { ...site.amenities };
                  if (!e.target.value) delete amenities.couponsOnSite;
                  else
                    amenities.couponsOnSite =
                      e.target.value === "unknown"
                        ? null
                        : e.target.value === "true";
                  onSite({ ...site, amenities });
                }}
              >
                <option value="">
                  Regional:{" "}
                  {profile?.local.amenities?.couponsOnSite == null
                    ? "unknown"
                    : profile.local.amenities.couponsOnSite
                      ? "yes"
                      : "no"}
                </option>
                <option value="true">Yes today</option>
                <option value="false">No today</option>
                <option value="unknown">Unknown today</option>
              </select>
              <small>
                Storage only. Bring your own when needed; check supply and
                access.
              </small>
            </label>
            {(
              [
                ["surface", "Surface", SURFACES],
                ["lighting", "Lighting", LIGHTING],
              ] as const
            ).map(([key, label, options]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={`${label} today`}
                  value={site.amenities?.[key] ?? ""}
                  onChange={(e) => {
                    const amenities = { ...site.amenities };
                    if (!e.target.value) delete amenities[key];
                    else
                      Object.assign(amenities, {
                        [key]: e.target.value as Amenities[typeof key],
                      });
                    onSite({ ...site, amenities });
                  }}
                >
                  <option value="">
                    Regional:{" "}
                    {
                      options[
                        (profile?.local.amenities?.[key] ??
                          "unknown") as keyof typeof options
                      ]
                    }
                  </option>
                  {Object.entries(options).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label>
            Today’s conditions
            <textarea
              value={site.notes}
              maxLength={800}
              onChange={(e) => onSite({ ...site, notes: e.target.value })}
              placeholder="The field is muddy. Stairs are closed. Keep us near the parking lot."
              rows={2}
            />
          </label>
        </fieldset>
        {profile?.local.sourceUrl && (
          <p className="muted">
            <a href={profile.local.sourceUrl} target="_blank" rel="noreferrer">
              AO description ↗
            </a>{" "}
            · Website reviewed {profile.local.checkedAt}. Access, distances and
            conditions still need a current check.
          </p>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSite({ overrides: {}, notes: "" })}
        >
          Reset today’s changes
        </button>
      </details>
    </section>
  );
}
