import React, { useEffect, useRef, useState } from "react";
import { STYLES, GEAR, fallbackPlan } from "./fallback";
import { SessionTimeline } from "./session";
import type { PlannerRequest } from "./planner-contract";
import { aoProfiles } from "./discovery";
import { workoutSchema, type Workout } from "./model";
import {
  GOLD_RUSH_EXAMPLE,
  plannerRequestSchema,
  plannerResponseSchema,
  type PlannerResponse,
} from "./planner-contract";
const SESSION_KEY = "fe-planner:assistant:v1";
type Preferences = Pick<
  import("./planner-contract").PlannerRequest,
  "ao" | "minutes" | "equipment" | "running" | "mary" | "provider"
>;
type Session = {
  prompt: string;
  result: PlannerResponse | null;
  preferences: Preferences;
};
const defaultPreferences: Preferences = {
  ao: "",
  minutes: 45,
  equipment: "From prompt",
  running: "From prompt",
  mary: true,
  provider: "auto",
};
function restore(): Session {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const value = JSON.parse(raw);
      return {
        prompt:
          typeof value.prompt === "string" ? value.prompt.slice(0, 1800) : "",
        result: value.result ? plannerResponseSchema.parse(value.result) : null,
        preferences: plannerRequestSchema
          .omit({ prompt: true, current: true })
          .parse(value.preferences ?? {}),
      };
    }
  } catch {
    /* An unreadable assistant session never replaces saved personal workouts. */
  }
  return { prompt: "", result: null, preferences: defaultPreferences };
}
export function Planner({
  onEdit,
  onPreview,
  onSave,
  onReference,
  onDraft,
}: {
  onDraft?: (w: Workout) => void;
  onEdit: (w: Workout) => void;
  onPreview: (w: Workout) => void;
  onSave: (w: Workout) => boolean;
  onReference: (id: string) => void;
}) {
  const [initial] = useState(restore),
    [prompt, setPrompt] = useState(initial.prompt),
    [result, setResult] = useState(initial.result),
    [revision, setRevision] = useState(""),
    [ao, setAO] = useState(initial.preferences.ao),
    [minutes, setMinutes] = useState(initial.preferences.minutes),
    [equipment, setEquipment] = useState(initial.preferences.equipment),
    [running, setRunning] = useState(initial.preferences.running),
    [mary, setMary] = useState(initial.preferences.mary),
    [provider, setProvider] = useState(initial.preferences.provider),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [storageError, setStorageError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (initial.result) onDraft?.(initial.result.workout);
  }, []);
  const [mode, setMode] = useState<"idea" | "formal">("idea");
  const [focus, setFocus] = useState("Full body"),
    [style, setStyle] = useState<(typeof STYLES)[number]>("Dora 1-2-3"),
    [gear, setGear] = useState<string[]>([]),
    [terrain, setTerrain] = useState("Q to confirm"),
    [pax, setPax] = useState(12),
    [qName, setQName] = useState(""),
    [title, setTitle] = useState("");
  const formal = {
    title,
    qName,
    focus,
    style,
    gear: gear as NonNullable<PlannerRequest["builder"]>["gear"],
    terrain,
    pax,
  };
  function surprise() {
    const pick = <T,>(values: readonly T[]) =>
      values[Math.floor(Math.random() * values.length)];
    const chosen = pick(STYLES),
      theme = pick([
        "Digging for gold",
        "Stronger together",
        "Keep showing up",
        "The long road home",
      ]);
    // Only gear explicitly confirmed by Q can enter a wildcard roll.
    const chosenGear = gear.length ? [pick(gear)] : [];
    const request = {
      prompt: `Surprise me with ${chosen}. Theme: ${theme}. Use ${chosenGear.join(", ") || "bodyweight"} on confirmed open flat ground.`,
      ao,
      minutes: 45,
      equipment: chosenGear.includes("Coupon")
        ? ("Coupon" as const)
        : chosenGear.length
          ? ("From prompt" as const)
          : ("None" as const),
      running,
      mary,
      provider,
      strictSchedule: true,
      builder: {
        ...formal,
        style: chosen,
        gear: chosenGear as NonNullable<PlannerRequest["builder"]>["gear"],
      },
    };
    setPrompt(request.prompt);
    void ask(false, request);
  }
  const controller = useRef<AbortController | null>(null),
    epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          prompt,
          result,
          preferences: { ao, minutes, equipment, running, mary, provider },
        }),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not keep the assistant session. Save a copy or print before leaving.",
      );
    }
  }, [prompt, result, ao, minutes, equipment, running, mary, provider]);
  async function ask(refine: boolean, override?: unknown) {
    const request = plannerRequestSchema.safeParse(
      override ?? {
        prompt: refine
          ? revision
          : mode === "formal"
            ? `Build ${style}. Focus: ${focus}. Terrain supplied by Q: ${terrain}. PAX: ${pax}. ${prompt}`
            : prompt,
        ao,
        minutes: 45,
        equipment:
          mode === "formal"
            ? gear.includes("Coupon")
              ? "Coupon"
              : gear.length
                ? "From prompt"
                : "None"
            : equipment,
        running,
        mary,
        provider,
        strictSchedule: true,
        ...(mode === "formal" ? { builder: formal } : {}),
        ...(refine && result ? { current: result.plan } : {}),
      },
    );
    if (!request.success) {
      setError("Describe your Q or change in at least 8 characters.");
      return;
    }
    const sequence = ++epoch.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 55000);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/plan-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.data),
        signal: abort.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          response.status === 429
            ? "Free AI has reached its current limit. Your previous draft is safe. Try later."
            : typeof data?.error === "string"
              ? data.error
              : "Free AI is unavailable. Your previous draft is safe.";
        throw Error(message);
      }
      const parsed = plannerResponseSchema.safeParse(data);
      if (!parsed.success)
        throw Error(
          "The AI returned an incomplete draft. Your previous draft is safe. Try again.",
        );
      const next = parsed.data;
      workoutSchema.parse(next.workout);
      if (sequence !== epoch.current) return;
      setResult(next);
      onDraft?.(next.workout);
      if (next.workout.provenance.ao) setAO(next.workout.provenance.ao);
      setMinutes(next.workout.duration ?? minutes);
      setMary(next.plan.sections.some((s) => s.kind === "mary"));
      setSaved(false);
      setRevision("");
    } catch (e) {
      if (sequence === epoch.current && !refine && !abort.signal.aborted) {
        const next = fallbackPlan(request.data);
        setResult(next);
        onDraft?.(next.workout);
        setSaved(false);
        setError(
          "AI is unavailable. An offline template is ready below; review it and edit requests the template could not apply.",
        );
      } else if (sequence === epoch.current)
        setError(
          abort.signal.aborted
            ? "Generation stopped. Your previous draft is safe."
            : e instanceof Error
              ? e.message
              : "Could not make a draft. Your previous draft is safe.",
        );
    } finally {
      clearTimeout(timeout);
      if (sequence === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="assistant no-print" aria-label="AI-assisted Q planner">
      <div className="assistant-intro">
        <div>
          <p className="eyebrow">YOUR NEXT Q STARTS HERE</p>
          <h1>What do you have in mind?</h1>
          <p>
            Tell us where you’re leading, what you want to use, and the idea
            you’re chasing.
          </p>
        </div>
        <span className="assistant-badge">AI-assisted · free models only</span>
      </div>
      <div className="entry-modes" aria-label="Choose how to build">
        <button type="button" disabled={busy} onClick={surprise}>
          <strong>Surprise Me!</strong>
          <span>A wildcard Q, ready to shape</span>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={mode === "idea"}
          onClick={() => setMode("idea")}
        >
          <strong>Enter an Idea</strong>
          <span>Tell us what you have in mind</span>
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={mode === "formal"}
          onClick={() => setMode("formal")}
        >
          <strong>Formal Builder</strong>
          <span>Choose the details of your Q</span>
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(false);
        }}
      >
        {mode === "formal" && (
          <fieldset disabled={busy} className="formal-builder">
            <legend>Build your beatdown</legend>
            <div className="assistant-grid">
              <label>
                Plan title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </label>
              <label>
                Q name
                <input
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  maxLength={160}
                />
              </label>
              <label>
                Fitness focus
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                >
                  {[
                    "Full body",
                    "Upper body",
                    "Legs",
                    "Core",
                    "Cardio endurance",
                    "Ruck strength",
                    "HIIT",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                F3 style
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as typeof style)}
                >
                  {STYLES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Terrain confirmed by Q
                <select
                  value={terrain}
                  onChange={(e) => setTerrain(e.target.value)}
                >
                  {[
                    "Q to confirm",
                    "Flat parking lot",
                    "Grass field",
                    "Track / bleachers",
                    "Playground / park",
                    "Covered shelter",
                    "Hills",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                PAX count
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={pax}
                  onChange={(e) => setPax(Number(e.target.value))}
                />
              </label>
            </div>
            <p>Available gear · select only what you can bring or confirm</p>
            <div className="gear-options">
              {GEAR.map((g) => (
                <label className="checkbox" key={g}>
                  <input
                    type="checkbox"
                    checked={gear.includes(g)}
                    onChange={() =>
                      setGear(
                        gear.includes(g)
                          ? gear.filter((x) => x !== g)
                          : [...gear, g],
                      )
                    }
                  />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="assistant-prompt">
          Describe your Q
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1800}
            rows={3}
            disabled={busy}
            placeholder={GOLD_RUSH_EXAMPLE}
          />
        </label>
        <button
          type="button"
          className="example-prompt"
          disabled={busy}
          onClick={() => setPrompt(GOLD_RUSH_EXAMPLE)}
        >
          Try the Gold Rush idea
        </button>
        <details className="assistant-preferences">
          <summary>
            Session preferences <span>45 minutes by default</span>
          </summary>
          <div className="assistant-grid">
            <label>
              Q location
              <select
                value={ao}
                disabled={busy}
                onChange={(e) => setAO(e.target.value)}
              >
                <option value="">Use my description</option>
                {aoProfiles.map((a) => (
                  <option key={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <p className="schedule-fixed">
              45-minute physical session
              <br />2 welcome · 8 warmup ·{" "}
              {mary ? "29 Thang · 6 Mary" : "35 Thang · Mary skipped"}
              <br />
              Fellowship follows the hard stop.
            </p>
            <label>
              Planner equipment
              <select
                value={equipment}
                disabled={busy}
                onChange={(e) =>
                  setEquipment(e.target.value as Preferences["equipment"])
                }
              >
                {["From prompt", "Coupon", "None"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Planner running
              <select
                value={running}
                disabled={busy}
                onChange={(e) =>
                  setRunning(e.target.value as Preferences["running"])
                }
              >
                {["From prompt", "None", "Light", "Moderate"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Free AI service
              <select
                disabled={busy}
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as Preferences["provider"])
                }
              >
                <option value="auto">Automatic · free only</option>
                <option value="gemini">Gemini · free tier</option>
                <option value="openrouter">OpenRouter · free models</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={mary}
                disabled={busy}
                onChange={(e) => setMary(e.target.checked)}
              />{" "}
              Include closing Mary
            </label>
          </div>
        </details>
        <div className="assistant-actions">
          <button
            className="create"
            disabled={busy || (mode === "idea" && prompt.trim().length < 8)}
            type="submit"
          >
            {busy
              ? "Working on your Q…"
              : result
                ? "Make a new draft"
                : "Build my workout"}
          </button>
          {!busy && (
            <button
              type="button"
              onClick={() => {
                const request = plannerRequestSchema.parse({
                  prompt: prompt.length >= 8 ? prompt : `Build ${style}`,
                  ao,
                  minutes: 45,
                  equipment:
                    mode === "formal"
                      ? gear.includes("Coupon")
                        ? "Coupon"
                        : gear.length
                          ? "From prompt"
                          : "None"
                      : equipment,
                  running,
                  mary,
                  strictSchedule: true,
                  ...(mode === "formal" ? { builder: formal } : {}),
                });
                const next = fallbackPlan(request);
                setResult(next);
                onDraft?.(next.workout);
                setSaved(false);
                setError("");
              }}
            >
              Use offline template
            </button>
          )}
          {busy && (
            <button
              type="button"
              onClick={() => {
                epoch.current++;
                controller.current?.abort();
                setBusy(false);
                setError("Generation stopped. Your previous draft is safe.");
              }}
            >
              Cancel generation
            </button>
          )}
        </div>
        <p className="assistant-privacy">
          Your description and, when refining, this draft go to our AI providers
          with an F3 briefing and selected reviewed workout references. Other
          saved workouts are not sent. Free limits may pause generation. New
          plans stay private until you choose to share them.
        </p>
      </form>
      {error && (
        <p className="assistant-error" role="alert">
          {error}
        </p>
      )}
      {storageError && (
        <p className="assistant-error" role="alert">
          {storageError}
        </p>
      )}
      {result && (
        <div className="assistant-result" aria-label="Generated workout draft">
          <div className="assistant-result-heading">
            <div>
              <p className="eyebrow">YOUR DRAFT · REVIEW BEFORE LEADING</p>
              <h2>{result.workout.title}</h2>
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
            <p className="template-label">
              Offline template · additional requests may need manual edits.
            </p>
          )}
          <SessionTimeline workout={result.workout} />
          <div className="assistant-sections">
            {result.plan.sections.map((s, i) => (
              <article key={s.kind}>
                <header>
                  <span>
                    {String(i + 1).padStart(2, "0")} /{" "}
                    {s.kind === "thang" ? "THE THANG" : s.kind.toUpperCase()}
                  </span>
                  <strong>
                    {s.blocks.reduce((n, b) => n + b.minutes, 0)} min
                  </strong>
                </header>
                <h3>{s.title}</h3>
                {s.blocks.map((b, j) => (
                  <div className="assistant-block" key={j}>
                    <h4>
                      {b.title} <span>~{b.minutes} min</span>
                    </h4>
                    <p className="source-text">{b.instructions}</p>
                    <ul>
                      {b.exercises.map((e, k) => (
                        <li key={k}>
                          <strong>
                            {e.name}: {e.amount} {e.unit}
                            {e.sets ? ` × ${e.sets} sets` : ""}
                          </strong>
                          <span className="count-label">{e.counting}</span>
                          <p>{e.instructions}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            ))}
          </div>
          <aside className="assistant-notes">
            <strong>Before you lead</strong>
            <ul>
              {result.plan.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <p>
              Check space, footing, equipment, counting rules and your PAX.
              Adjust work, rest and load. This is an AI-assisted draft, not a
              reviewed regional original.
            </p>
          </aside>
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
                placeholder="Less running. Keep the gold theme and make the main work partner-based."
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
            <button type="submit" disabled={busy || revision.trim().length < 8}>
              Refine this draft
            </button>
          </form>
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
          <details className="assistant-references">
            <summary>F3 context & workout references</summary>
            <p>
              Every request includes F3 terms, plain exercise instructions,
              counting rules and verified AO facts. Unconfirmed site features
              stay unknown.
            </p>
            <p>
              Reference material supplied to {result.provider}; the draft is a
              new adaptation.
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
      )}
    </section>
  );
}
