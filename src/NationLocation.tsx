import directory from "../data/ao-nation.json";
export function NationLocation({
  aoId,
  seasonal = false,
  rotating = false,
}: {
  aoId: string;
  seasonal?: boolean;
  rotating?: boolean;
}) {
  if (rotating)
    return (
      <p className="ao-map-reference">
        Meeting points rotate. Confirm this event’s location and route with the
        Q.
      </p>
    );
  const reference = directory.aos.find((ao) => ao.localId === aoId);
  if (!reference) return null;
  const location = reference.defaultLocation;
  const url = new URL("https://map.f3nation.com/");
  url.searchParams.set("locationId", String(location.id));
  url.searchParams.set("lat", String(location.latitude));
  url.searchParams.set("lng", String(location.longitude));
  url.searchParams.set("zoom", "16");
  return (
    <p className="ao-map-reference">
      <a href={url.href} target="_blank" rel="noreferrer">
        F3 Nation map ↗
      </a>
      <br />
      <small>
        Listed default: {location.locationName}.
        {seasonal
          ? " Seasonal meeting points may differ; check the venue notes."
          : " Confirm the Q’s flag placement."}
      </small>
    </p>
  );
}
