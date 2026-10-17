import React, { useEffect, useRef, useState } from "react";
import { STYLES, GEAR, fallbackPlan } from "./fallback";
import { SessionTimeline } from "./session";
import type { PlannerRequest } from "./planner-contract";
import { findAO } from "./ao-context";
import { aoProfiles } from "./discovery";
import { AOContextPanel } from "./AOContextPanel";
import type { SiteInput } from "./site-contract";
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
  | "ao"
  | "minutes"
  | "equipment"
  | "running"
  | "mary"
  | "provider"
  | "startTime"
  | "site"
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
  startTime: "05:30",
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
    [provider] = useState(initial.preferences.provider),
    [startTime, setStartTime] = useState(initial.preferences.startTime),
    [site, setSite] = useState<SiteInput>(
      initial.preferences.site ?? { overrides: {}, notes: "" },
    ),
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
    [pax, setPax] = useState(12),
    [qName, setQName] = useState(""),
    [title, setTitle] = useState("");
  const formal = {
    title,
    qName,
    focus,
    style,
    gear: gear as NonNullable<PlannerRequest["builder"]>["gear"],
    terrain: "Use confirmed AO features and today's overrides only",
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
    const availableGear =
      mode === "formal"
        ? gear
        : equipment === "Coupon"
          ? ["Coupon"]
          : equipment === "None"
            ? []
            : /coupon|cindy/i.test(prompt)
              ? ["Coupon"]
              : [];
    const chosenAO = ao || findAO("", prompt)?.name || (aoProfiles[0]?.name ?? "Clocktower");
    if (!ao) setAO(chosenAO);
    const chosenTime = startTime || "05:30";
    if (!startTime) setStartTime(chosenTime);
    const chosenGear = availableGear.length ? [pick(availableGear)] : [];
    const request = {
      prompt: `Surprise me with ${chosen}. Theme: ${theme}. Use ${chosenGear.join(", ") || "bodyweight"} on confirmed open flat ground.`,
      ao: chosenAO,
      startTime: chosenTime,
      site,
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
    epoch = useRef(0),
    resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [result]);

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
          preferences: {
            ao,
            minutes,
            equipment,
            running,
            mary,
            provider,
            startTime,
            site,
          },
        }),
      );
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not keep the assistant session. Save a copy or print before leaving.",
      );
    }
  }, [
    prompt,
    result,
    ao,
    minutes,
    equipment,
    running,
    mary,
    provider,
    startTime,
    site,
  ]);
  async function ask(refine: boolean, override?: unknown) {
    const request = plannerRequestSchema.safeParse(
      override ?? {
        prompt: refine
          ? revision
          : mode === "formal"
            ? `Build ${style}. Focus: ${focus}. PAX: ${pax}. ${prompt}`
            : prompt,
        ao,
        startTime,
        site,
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
      setError(
        request.error.issues.some((i) => i.path[0] === "startTime")
          ? "Choose a start time."
          : "Add a short idea and check your details.",
      );
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
        setError("");
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
          <h1>Plan your next Q.</h1>
          <p className="assistant-subhead">An AO, an idea, a balanced 45-minute plan you can lead with confidence.</p>
        </div>
        <span className="assistant-badge">AI-assisted · free models only</span>
      </div>

      <div className="planner-quickstart-banner" aria-label="How planning works">
        <div className="quickstart-step">
          <span className="quickstart-num">1</span>
          <div>
            <strong>Pick Where & When</strong>
            <span>Select your AO location</span>
          </div>
        </div>
        <div className="quickstart-divider" aria-hidden="true">→</div>
        <div className="quickstart-step">
          <span className="quickstart-num">2</span>
          <div>
            <strong>Choose Your Style</strong>
            <span>Surprise, custom idea, or formal</span>
          </div>
        </div>
        <div className="quickstart-divider" aria-hidden="true">→</div>
        <div className="quickstart-step">
          <span className="quickstart-num">3</span>
          <div>
            <strong>Lead on the Field</strong>
            <span>Timer, cadence & Q-sheet ready</span>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(false);
        }}
      >
        <div className="planner-step-box step-1-box">
          <div className="step-box-header">
            <span className="step-box-badge">STEP 1</span>
            <div>
              <h3>Pick Where & When</h3>
              <p className="step-box-sub">Choose your AO and start time so exercises match verified site terrain.</p>
            </div>
          </div>
          <AOContextPanel
            ao={ao}
            prompt={prompt}
            startTime={startTime}
            site={site}
            disabled={busy}
            onTime={setStartTime}
            onSite={setSite}
            onAO={(value) => {
              setAO(value);
              setSite({ overrides: {}, notes: "" });
              const matched = findAO(value);
              if (matched) setStartTime(matched.sessions[0]?.time ?? "05:30");
            }}
          />
        </div>

        <div className="planner-step-box step-2-box">
          <div className="step-box-header">
            <span className="step-box-badge">STEP 2</span>
            <div>
              <h3>Choose Your Style & Build</h3>
              <p className="step-box-sub">Pick a mode: 1-tap roll, custom idea, or structured beatdown.</p>
            </div>
          </div>

          <div className="entry-modes" aria-label="Choose how to build">
            <button
              type="button"
              disabled={busy}
              className="mode-btn mode-surprise"
              onClick={surprise}
            >
              <span className="mode-badge">🎲 Quick Roll</span>
              <strong>Surprise Me!</strong>
              <span>1-tap balanced plan for your AO</span>
            </button>
            <button
              type="button"
              disabled={busy}
              className={`mode-btn ${mode === "idea" ? "mode-selected" : ""}`}
              aria-pressed={mode === "idea"}
              onClick={() => setMode("idea")}
            >
              <span className="mode-badge">💡 Freeform</span>
              <strong>Enter an Idea</strong>
              <span>Tell us your theme, gear, or vision</span>
            </button>
            <button
              type="button"
              disabled={busy}
              className={`mode-btn ${mode === "formal" ? "mode-selected" : ""}`}
              aria-pressed={mode === "formal"}
              onClick={() => setMode("formal")}
            >
              <span className="mode-badge">📋 Structured</span>
              <strong>Formal Builder</strong>
              <span>Choose focus, style, gear & PAX</span>
            </button>
          </div>
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
                    onChange={() => {
                      if (
                        !gear.includes(g) &&
                        (g === "Bleachers / stairs" || g === "Pull-up bar")
                      )
                        setSite({
                          ...site,
                          overrides: {
                            ...site.overrides,
                            [g === "Pull-up bar" ? "pullupBars" : "stairs"]:
                              "available",
                          },
                        });
                      setGear(
                        gear.includes(g)
                          ? gear.filter((x) => x !== g)
                          : [...gear, g],
                      );
                    }}
                  />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="assistant-prompt">
          {mode === "formal" ? "Additional instructions (optional)" : "Describe your Q"}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1800}
            rows={3}
            disabled={busy}
            placeholder={mode === "formal" ? "Any specific exercises, theme, or special instructions..." : GOLD_RUSH_EXAMPLE}
          />
        </label>
        <div className="prompt-inspiration-bar">
          <span className="inspiration-label">Need inspiration?</span>
          <button
            type="button"
            className="example-prompt"
            disabled={busy}
            onClick={() => setPrompt(GOLD_RUSH_EXAMPLE)}
          >
            Try the Gold Rush idea
          </button>
          <button
            type="button"
            className="inspiration-pill"
            disabled={busy}
            onClick={() => setPrompt("Dora 1-2-3 with coupons: 100 Merkins, 200 Big Boys, 300 Squats while partner runs.")}
          >
            Dora 1-2-3
          </button>
          <button
            type="button"
            className="inspiration-pill"
            disabled={busy}
            onClick={() => setPrompt("11s Ladder on the hill: Burpees at the bottom, Carolina Dry Docks at the top.")}
          >
            11s Hill Ladder
          </button>
          <button
            type="button"
            className="inspiration-pill"
            disabled={busy}
            onClick={() => setPrompt("Full body grinder: Bear crawls, lunges, and plank variations.")}
          >
            Bodyweight Grinder
          </button>
        </div>
        <div className="assistant-actions">
          <button
            className="create"
            disabled={busy || (mode === "idea" && prompt.trim().length < 3)}
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
                const request = plannerRequestSchema.safeParse({
                  prompt: prompt.length >= 3 ? prompt : `Build ${style}`,
                  ao,
                  startTime,
                  site,
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
                if (!request.success) {
                  setError("Choose a start time and check your details.");
                  return;
                }
                const next = fallbackPlan(request.data);
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
        <details className="assistant-preferences">
          <summary>
            Session preferences <span>45 minutes by default</span>
          </summary>
          <div className="assistant-grid">
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
        <p className="assistant-privacy">
          Your idea, site details and current draft go to our free AI providers.
          Other saved workouts are not sent. Offline templates work without AI.
        </p>
        </div>
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
      {!result && !busy && (
        <div className="planner-discovery-callout" aria-label="Library suggestion">
          <span className="callout-tag">NEED PROVEN INSPIRATION?</span>
          <p>
            You don't have to start from scratch. Switch to the <strong>Library</strong> tab to lead from 35+ battle-tested F3 workouts with complete timing and exercises, or browse the <strong>Exicon & Lexicon</strong> to discover new movements.
          </p>
        </div>
      )}
      {result && (
        <div
          ref={resultRef}
          tabIndex={-1}
          className="assistant-result planner-step-box step-3-box"
          aria-label="Generated workout draft"
        >
          <div className="step-box-header step-3-header-bar">
            <span className="step-box-badge step-badge-ready">STEP 3 · FIELD READY</span>
            <div>
              <h3>Lead on the Field</h3>
              <p className="step-box-sub">Your custom beatdown is ready for the gloom. Review, print, or launch the live timer.</p>
            </div>
            <div className="step-3-quick-actions no-print">
              <button
                type="button"
                className="step-print-btn"
                onClick={() => window.print()}
              >
                🖨️ Print Q-Sheet
              </button>
            </div>
          </div>
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
            <button type="submit" disabled={busy || revision.trim().length < 3}>
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
