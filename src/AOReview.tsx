import { useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { parseAOUpdate, type AOUpdate } from "./ao-review";
import { FEATURES } from "./site-contract";
import { aoProfiles } from "./discovery";
export function AOReview() {
  const [text, setText] = useState("");
  const [review, setReview] = useState<AOUpdate | null>(null);
  const [error, setError] = useState("");
  const version = useRef(0);
  function change(value: string) {
    version.current++;
    setText(value);
    setReview(null);
    setError("");
  }
  return (
    <details className="ao-review">
      <summary>
        <AppIcon name="review" />
        Review an AO update
      </summary>
      <p>
        Check a source-backed proposal before sending it for regional review.
        Opening or reviewing a file does not change regional facts or your
        planning notes.
      </p>
      <label>
        AO update file
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            const seq = ++version.current;
            event.target.value = "";
            if (!file) return;
            try {
              if (file.size > 80000) throw Error("AO update exceeds 80 KB.");
              const value = await file.text();
              if (seq !== version.current) return;
              change(value);
            } catch (e) {
              if (seq === version.current)
                setError(
                  e instanceof Error ? e.message : "Could not read file.",
                );
            }
          }}
        />
      </label>
      <label>
        AO update JSON
        <textarea
          value={text}
          maxLength={80000}
          onChange={(event) => change(event.target.value)}
          rows={6}
        />
      </label>
      <button
        disabled={!text.trim()}
        onClick={() => {
          try {
            setReview(parseAOUpdate(text));
            setError("");
          } catch (e) {
            setReview(null);
            setError(e instanceof Error ? e.message : "Invalid AO update");
          }
        }}
      >
        <AppIcon name="review" />
        Review proposal
      </button>
      {error && <p role="alert">{error}</p>}
      {review && (
        <section aria-label="AO proposal review">
          <h3>{aoProfiles.find((ao) => ao.id === review.aoId)?.name}</h3>
          <p>
            {review.source} · checked {review.checkedAt}
          </p>
          <a href={review.sourceUrl} target="_blank" rel="noreferrer">
            View source
          </a>
          <ul>
            {Object.entries(review.features).map(([key, value]) => (
              <li key={key}>
                {FEATURES[key as keyof typeof FEATURES]}: {value.state} ·{" "}
                {value.detail}
              </li>
            ))}
          </ul>
          {review.amenities && (
            <dl>
              {Object.entries(review.amenities).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value === null ? "Unknown" : String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          {review.venues.map((venue) => (
            <p key={venue.id}>
              <strong>{venue.name}</strong> · {venue.season} · {venue.access}
              {Object.entries(venue.features).map(([key, value]) => (
                <span key={key}>
                  {" "}
                  · {FEATURES[key as keyof typeof FEATURES]}: {value.state} ·{" "}
                  {value.detail}
                </span>
              ))}
            </p>
          ))}
          {review.landmarks.map((landmark) => (
            <p key={landmark.name}>
              <strong>{landmark.name}</strong> · {landmark.status} ·{" "}
              {landmark.use}
              <br />
              {landmark.description} {landmark.restrictions}
            </p>
          ))}
          <p>{review.accessNotes}</p>
          <p>
            Regional publication requires a repository maintainer’s review and
            release. This screen has no publishing permission.
          </p>
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(review, null, 2)], {
                  type: "application/json",
                }),
              );
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `${review.aoId}-proposal.json`;
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <AppIcon name="markdown" />
            Export proposal
          </button>
        </section>
      )}
    </details>
  );
}
