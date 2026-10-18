import type { RefObject } from "react";
import type { PlannerResponse } from "./planner-contract";
import type { Workout } from "./model";
import { SessionTimeline } from "./session";
export function PlannerDraft({
  result,
  resultRef,
  busy,
  saved,
  setSaved,
  revision,
  setRevision,
  ask,
  onSave,
  onLead,
  onEdit,
  onPreview,
  onReference,
  onSetup,
}: {
  result: PlannerResponse;
  resultRef: RefObject<HTMLDivElement | null>;
  busy: boolean;
  saved: boolean;
  setSaved: (saved: boolean) => void;
  revision: string;
  setRevision: (text: string) => void;
  ask: (refine: boolean) => Promise<void>;
  onSave: (w: Workout) => boolean;
  onLead?: (w: Workout) => void;
  onEdit: (w: Workout) => void;
  onPreview: (w: Workout) => void;
  onReference: (id: string) => void;
  onSetup: () => void;
}) {
  return (
    <div
      ref={resultRef}
      tabIndex={-1}
      className="assistant-result"
      aria-label="Generated workout draft"
    >
      <button type="button" className="back-to-setup" onClick={onSetup}>
        ← Back to setup
      </button>
      <div className="assistant-result-heading">
        <div>
          <p className="eyebrow">YOUR DRAFT · REVIEW BEFORE LEADING</p>
          <h1>{result.workout.title}</h1>
          <p>{result.workout.summary}</p>
        </div>
        <span>
          {result.workout.duration} min ·{" "}
          {result.workout.provenance.ao ?? "AO to confirm"}
        </span>
      </div>
      <p className="assistant-result-meta">
        {result.workout.equipment.join(", ") || "No equipment"} ·{" "}
        {result.workout.running === "None"
          ? "No running"
          : result.workout.running + " running"}{" "}
        · Timings are estimates
      </p>
      {result.provider === "Template" && (
        <div className="template-label" role="status">
          <strong>
            Offline template · additional requests may need manual edits.
          </strong>
          {result.fallbackReason && (
            <p>
              {result.fallbackReason} You can retry AI from your setup or edit
              this template.
            </p>
          )}
        </div>
      )}
      <div className="assistant-actions">
        <button
          className="create"
          type="button"
          disabled={busy || saved}
          onClick={() => {
            if (onSave(result.workout)) setSaved(true);
          }}
        >
          {saved ? "Copy saved on this device" : "Save a private copy"}
        </button>
        {onLead && (
          <button
            type="button"
            onClick={() => onLead(structuredClone(result.workout))}
          >
            Launch Field Q-Timer
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(structuredClone(result.workout))}
        >
          Edit the details
        </button>
        <button
          type="button"
          onClick={() => onPreview(structuredClone(result.workout))}
        >
          Preview & print
        </button>
      </div>
      <SessionTimeline workout={result.workout} />
      <div className="assistant-sections">
        {result.plan.sections.map((s, i) => {
          const content = (
            <article className={"draft-section draft-" + s.kind} key={s.kind}>
              <header>
                <span>
                  {String(i + 1).padStart(2, "0")} /{" "}
                  {s.kind === "thang" ? "THE THANG" : s.kind.toUpperCase()}
                </span>
                <strong>
                  {s.blocks.reduce((n, b) => n + b.minutes, 0)} min
                </strong>
              </header>
              <h2>{s.title}</h2>
              {s.blocks.map((b, j) => (
                <div className="assistant-block" key={j}>
                  <h3>
                    {b.title} <span>~{b.minutes} min</span>
                  </h3>
                  <p className="source-text">{b.instructions}</p>
                  <ul>
                    {b.exercises.map((e, k) => (
                      <li key={k}>
                        <strong>
                          {e.name}: {e.amount} {e.unit}
                          {e.sets ? ` × ${e.sets} sets` : ""}
                        </strong>
                        <span className="count-label">{e.counting}</span>
                        <details className="movement-help">
                          <summary>Movement details</summary>
                          <p>{e.instructions}</p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          );
          return s.kind === "thang" ? (
            content
          ) : (
            <details className="supporting-phase" key={s.kind}>
              <summary>
                {s.title} · {s.blocks.reduce((n, b) => n + b.minutes, 0)} min
              </summary>
              {content}
            </details>
          );
        })}
      </div>
      <details className="assistant-notes">
        <summary>Review notes & modifications</summary>
        <strong>Before you lead</strong>
        <ul>
          {result.plan.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        <p>
          Check space, footing, equipment, counts and modifications before
          leading. This is a personal draft.
        </p>
      </details>
      <form
        className="assistant-refine"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(true);
        }}
      >
        <label>
          What would you change?
          <textarea
            value={revision}
            disabled={busy}
            maxLength={1800}
            rows={2}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="Keep the structure, add partner work, and simplify the counts…"
          />
        </label>
        <div className="refine-chips">
          {[
            "Less running, keep everything else.",
            "Make the main work partner-based.",
            "Simplify the instructions and transitions.",
          ].map((text) => (
            <button
              key={text}
              type="button"
              disabled={busy}
              onClick={() => setRevision(text)}
            >
              {text}
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy || revision.trim().length < 3}>
          Refine this draft
        </button>
      </form>
      <details className="assistant-references">
        <summary>F3 context & workout references</summary>
        <p>
          Every request includes F3 terms, plain exercise instructions, counting
          rules and verified AO facts. Unconfirmed site features stay unknown.
        </p>
        <p>
          Reference material supplied to {result.provider}; the draft is a new
          adaptation.
        </p>
        <ul>
          {result.references.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onReference(r.id)}>
                {r.title}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
