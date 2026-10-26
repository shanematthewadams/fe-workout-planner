import { selectAOContext, type AOIntelligence } from "./ao-catalog";
export function AOCatalogDetails({
  catalog,
  venueId,
}: {
  catalog: AOIntelligence;
  venueId?: string;
}) {
  const current = selectAOContext(catalog, venueId);
  const labels: Record<string, string> = {
    present: "Reported present",
    absent: "Reported absent",
    restricted: "Restricted — check access",
    unknown: "Not confirmed",
  };
  const facts = current.venue?.ao_venue_amenities ?? [];
  const name = (id: string) =>
    id.replaceAll("-", " ").replace(/^./, (v) => v.toUpperCase());
  return (
    <details className="ao-catalog-details">
      <summary>Facilities & landmarks</summary>
      {catalog.activity !== "bootcamp" && <p>{catalog.planning_mode}</p>}
      <p>
        Reported local knowledge. Confirm access and current conditions with the
        Site Q.
      </p>
      {current.venueRequired ? (
        <p>
          {catalog.location_mode === "rotating"
            ? "The meeting point and route change with each event. No permanent facilities are assumed."
            : "Choose the venue to see its facilities and landmarks."}
        </p>
      ) : (
        <dl>
          {(["present", "restricted", "absent", "unknown"] as const).map(
            (state) => {
              const group = facts.filter(
                (f) =>
                  (f.verification === "unverified"
                    ? "unknown"
                    : f.availability) === state,
              );
              return group.length ? (
                <div key={state}>
                  <dt>{labels[state]}</dt>
                  <dd>
                    {group
                      .map(
                        (f) => f.ao_amenity_types?.name ?? name(f.amenity_id),
                      )
                      .join(", ")}
                  </dd>
                </div>
              ) : null;
            },
          )}
        </dl>
      )}
      {!!current.landmarks.length && (
        <ul className="ao-landmarks">
          {current.landmarks.map(({ proximity, ao_landmarks: l }) => (
            <li key={l.id}>
              <strong>{l.name}</strong>{" "}
              <span>
                ·{" "}
                {proximity === "nearby"
                  ? "Nearby destination"
                  : proximity === "on_site"
                    ? "At this venue"
                    : "Location needs confirmation"}
                {/indoor|gathering|coffeeteria/i.test(
                  l.kind + " " + l.use_cases,
                )
                  ? " · Gathering access; workout permission not confirmed"
                  : ""}
              </span>
              <p>{l.description}</p>
              {l.restrictions && <small>{l.restrictions}</small>}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        <a href={catalog.ao_sources.url} target="_blank" rel="noreferrer">
          AO inventory source ↗
        </a>
      </p>
    </details>
  );
}
