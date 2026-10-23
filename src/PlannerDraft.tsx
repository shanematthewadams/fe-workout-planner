import { useRef, useState, type RefObject } from "react";
import type { PlannerResponse } from "./planner-contract";
import type { Workout } from "./model";
import { Undo2 } from "lucide-react";
import { MovementPicker } from "./MovementPicker";
import { AppIcon } from "./AppIcon";
import { qSheet } from "./session";
import { exerciseSchema } from "./model";
import { SessionTimeline } from "./session";
export function PlannerDraft({
  result,
  resultRef,
  busy,
  saved,
  saveError,
  onChange,
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
  saveError: boolean;
  onChange: (next: PlannerResponse) => void;
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
  const [editExercise, setEditExercise] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [history, setHistory] = useState<PlannerResponse[]>([]);
  const editedPlan = useRef(result.plan);
  const validHistory = editedPlan.current === result.plan ? history : [];
  function commit(next: PlannerResponse) {
    setHistory([...validHistory.slice(-19), structuredClone(result)]);
    editedPlan.current = next.plan;
    onChange(next);
  }
  function undo() {
    const previous = validHistory.at(-1);
    if (!previous) return;
    const next = structuredClone(previous);
    // Saving may assign a private copy identity; Undo only changes its content.
    next.workout.id = result.workout.id;
    next.workout.attribution = result.workout.attribution;
    next.workout.originId = result.workout.originId;
    next.workout.updatedAt = new Date().toISOString();
    setHistory(validHistory.slice(0, -1));
    editedPlan.current = next.plan;
    setEditExercise(null);
    onChange(next);
  }
  function changeExercise(
    si: number,
    bi: number,
    ei: number,
    patch: Partial<
      Workout["sections"][number]["blocks"][number]["exercises"][number]
    >,
  ) {
    const next = structuredClone(result);
    Object.assign(next.workout.sections[si].blocks[bi].exercises[ei], patch);
    Object.assign(next.plan.sections[si].blocks[bi].exercises[ei], patch);
    commit(next);
  }
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
      <p className="draft-next-step" role="status">
        {saveError
          ? "Could not save on this device. Your open workout is still here. Retry saving before leaving."
          : saved
            ? "Saved on this device · Find it in My Workouts. Cloud status is shown separately."
            : "Saving on this device…"}
      </p>
      <div className="assistant-actions">
        {saveError && (
          <button type="button" onClick={() => onSave(result.workout)}>
            <AppIcon name="reset" />
            Retry saving
          </button>
        )}
        {onLead && (
          <button
            className="create"
            type="button"
            disabled={busy || !saved}
            onClick={() => onLead(structuredClone(result.workout))}
          >
            <AppIcon name="play" />
            Lead this workout
          </button>
        )}
        <button
          type="button"
          onClick={() => onPreview(structuredClone(result.workout))}
        >
          <AppIcon name="sheet" />
          Print workout
        </button>
        <button
          type="button"
          onClick={() => {
            if (!navigator.clipboard) {
              setCopyMessage(
                "Clipboard unavailable. Print your workout to keep a copy.",
              );
              return;
            }
            void navigator.clipboard
              .writeText(qSheet(result.workout))
              .then(() => setCopyMessage("Workout copied for Slack."))
              .catch(() =>
                setCopyMessage(
                  "Clipboard unavailable. Print your workout to keep a copy.",
                ),
              );
          }}
        >
          <AppIcon name="sheet" />
          Copy for Slack
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onEdit(structuredClone(result.workout))}
        >
          <AppIcon name="details" />
          More editing options
        </button>
      </div>
      <button
        type="button"
        disabled={busy || !validHistory.length}
        onClick={undo}
      >
        <Undo2 size={16} aria-hidden="true" /> Undo last edit
      </button>
      {copyMessage && <p role="status">{copyMessage}</p>}
      <label className="workout-title-edit">
        Workout name
        <input
          aria-label="Workout name"
          maxLength={160}
          value={result.workout.title}
          disabled={busy}
          onChange={(event) => {
            const next = structuredClone(result);
            next.workout.title = event.target.value;
            next.plan.title = event.target.value;
            commit(next);
          }}
        />
      </label>
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
                  <label className="block-time-edit">
                    Block minutes
                    <input
                      type="number"
                      aria-label={`${s.title} block ${j + 1} minutes`}
                      min={1}
                      max={60}
                      value={b.minutes}
                      disabled={busy}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (value < 1 || value > 60) return;
                        const next = structuredClone(result);
                        next.plan.sections[i].blocks[j].minutes = value;
                        next.workout.sections[i].blocks[j].minutes = value;
                        // Physical session stays 45 minutes; timeline shows any mismatch.
                        commit(next);
                      }}
                    />
                  </label>
                  <p className="source-text">{b.instructions}</p>
                  <ul>
                    {b.exercises.map((e, k) => (
                      <li key={k}>
                        <button
                          className="exercise-edit-trigger"
                          type="button"
                          disabled={busy}
                          aria-expanded={editExercise === `${i}-${j}-${k}`}
                          onClick={() =>
                            setEditExercise(
                              editExercise === `${i}-${j}-${k}`
                                ? null
                                : `${i}-${j}-${k}`,
                            )
                          }
                        >
                          <AppIcon name="details" />
                          Edit {e.name}
                        </button>
                        <strong>
                          {e.name}: {e.amount} {e.unit}
                          {e.sets ? ` × ${e.sets} sets` : ""}
                        </strong>
                        <span className="count-label">{e.counting}</span>
                        {editExercise === `${i}-${j}-${k}` && (
                          <fieldset className="inline-exercise" disabled={busy}>
                            <legend>Edit this exercise</legend>
                            <MovementPicker
                              action="Swap"
                              onAdd={(replacement) =>
                                changeExercise(i, j, k, {
                                  name: replacement.name,
                                  instructions: replacement.instructions,
                                })
                              }
                            />
                            <label>
                              Exercise
                              <input
                                value={e.name}
                                maxLength={120}
                                onChange={(event) =>
                                  changeExercise(i, j, k, {
                                    name: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Reps or duration
                              <input
                                value={e.amount}
                                maxLength={120}
                                onChange={(event) =>
                                  changeExercise(i, j, k, {
                                    amount: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Unit
                              <select
                                value={e.unit}
                                onChange={(event) =>
                                  changeExercise(i, j, k, {
                                    unit: event.target.value as typeof e.unit,
                                  })
                                }
                              >
                                {exerciseSchema.shape.unit.options.map(
                                  (unit) => (
                                    <option key={unit}>{unit}</option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label>
                              Counting
                              <select
                                value={e.counting}
                                onChange={(event) =>
                                  changeExercise(i, j, k, {
                                    counting: event.target
                                      .value as typeof e.counting,
                                  })
                                }
                              >
                                {exerciseSchema.shape.counting.options.map(
                                  (count) => (
                                    <option key={count}>{count}</option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label>
                              Instructions
                              <textarea
                                value={e.instructions}
                                maxLength={3000}
                                onChange={(event) =>
                                  changeExercise(i, j, k, {
                                    instructions: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <button
                              type="button"
                              disabled={k === 0}
                              onClick={() => {
                                const next = structuredClone(result);
                                for (const sections of [
                                  next.plan.sections,
                                  next.workout.sections,
                                ]) {
                                  const exercises =
                                    sections[i].blocks[j].exercises;
                                  [exercises[k - 1], exercises[k]] = [
                                    exercises[k],
                                    exercises[k - 1],
                                  ];
                                }
                                setEditExercise(`${i}-${j}-${k - 1}`);
                                commit(next);
                              }}
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              disabled={k === b.exercises.length - 1}
                              onClick={() => {
                                const next = structuredClone(result);
                                for (const sections of [
                                  next.plan.sections,
                                  next.workout.sections,
                                ]) {
                                  const exercises =
                                    sections[i].blocks[j].exercises;
                                  [exercises[k + 1], exercises[k]] = [
                                    exercises[k],
                                    exercises[k + 1],
                                  ];
                                }
                                setEditExercise(`${i}-${j}-${k + 1}`);
                                commit(next);
                              }}
                            >
                              Move down
                            </button>
                            <p className="muted">
                              To swap, change the exercise name and instructions
                              above. Reps, timing and other exercises stay as
                              they are.
                            </p>
                            <button
                              type="button"
                              disabled={b.exercises.length <= 1}
                              onClick={() => {
                                const next = structuredClone(result);
                                next.workout.sections[i].blocks[
                                  j
                                ].exercises.splice(k, 1);
                                next.plan.sections[i].blocks[
                                  j
                                ].exercises.splice(k, 1);
                                setEditExercise(null);
                                commit(next);
                              }}
                            >
                              Remove exercise
                            </button>
                            {b.exercises.length <= 1 && (
                              <p className="muted">
                                Keep one exercise in this block. Rename it to
                                swap.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditExercise(null)}
                            >
                              Done editing
                            </button>
                          </fieldset>
                        )}
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
          return content;
        })}
      </div>
      <section className="draft-section draft-cot">
        <header>
          <span>COT · AFTER THE WORKOUT</span>
        </header>
        <h2>Circle of Trust</h2>
        <p>Count-o-Rama · Name-o-Rama · Announcements · Closing.</p>
        <label>
          Your closing thought
          <textarea
            rows={2}
            maxLength={2000}
            disabled={busy}
            value={result.workout.rawNotes}
            onChange={(event) => {
              const next = structuredClone(result);
              next.workout.rawNotes = event.target.value;
              commit(next);
            }}
            placeholder="What do you want the PAX to take with them?"
          />
        </label>
      </section>
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
      <details className="creative-help">
        <summary>
          <AppIcon name="builder" /> Help me change this
        </summary>
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
      </details>
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
