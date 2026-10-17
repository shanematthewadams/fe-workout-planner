import React, { useEffect, useRef, useState } from "react";
import { STYLES, GEAR, fallbackPlan } from "./fallback";
import type { PlannerRequest } from "./planner-contract";
import { findAO } from "./ao-context";
import { withLocalAO, retainQContext } from "./ao-drafts";
import { AOContextPanel } from "./AOContextPanel";
import type { SiteInput } from "./site-contract";
import { workoutSchema, type Workout } from "./model";
import {
  GOLD_RUSH_EXAMPLE,
  plannerRequestSchema,
  resolveRequest,
  plannerResponseSchema,
} from "./planner-contract";
import { restorePlannerSession, SESSION_KEY } from "./planner-session";
import { PlannerDraft } from "./PlannerDraft";
export function Planner({
  onEdit,
  onPreview,
  onSave,
  onReference,
  onDraft,
  onLead,
}: {
  onDraft?: (w: Workout) => void;
  onLead?: (w: Workout) => void;
  onEdit: (w: Workout) => void;
  onPreview: (w: Workout) => void;
  onSave: (w: Workout) => boolean;
  onReference: (id: string) => void;
}) {
  const [initial] = useState(restorePlannerSession),
    [prompt, setPrompt] = useState(initial.prompt),
    [result, setResult] = useState(initial.result),
    [revision, setRevision] = useState(initial.revision),
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
  const [view, setView] = useState<"build" | "review">(
    initial.result ? "review" : "build",
  );
  const [lastRequest, setLastRequest] = useState(initial.request);
  const [mode, setMode] = useState<"idea" | "formal">(initial.mode);
  const [focus, setFocus] = useState(initial.builder.focus),
    [style, setStyle] = useState<(typeof STYLES)[number]>(
      initial.builder.style,
    ),
    [gear, setGear] = useState<string[]>(initial.builder.gear),
    [pax, setPax] = useState(initial.builder.pax),
    [qName, setQName] = useState(initial.builder.qName),
    [title, setTitle] = useState(initial.builder.title);
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
    const resolvedEquipment = resolveRequest({
      prompt: prompt.trim().length >= 3 ? prompt : "Surprise me",
      equipment,
    }).equipment;
    const availableGear =
      mode === "formal"
        ? gear
        : resolvedEquipment === "Coupon"
          ? ["Coupon"]
          : resolvedEquipment === "None"
            ? []
            : /coupon|cindy/i.test(prompt)
              ? ["Coupon"]
              : [];
    const chosenAO = ao || findAO("", prompt)?.name || "";
    if (!ao) setAO(chosenAO);
    const chosenTime = startTime || "05:30";
    if (!startTime) setStartTime(chosenTime);
    const chosenGear = availableGear.length ? [pick(availableGear)] : [];
    const request = {
      prompt: `Surprise me with ${chosen}. Theme: ${theme}. Use ${chosenGear.join(", ") || "bodyweight"} on confirmed open flat ground.`,
      ao: chosenAO,
      startTime: chosenTime,
      site: retainQContext(chosenAO, prompt, site),
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
    if (view === "review" && result && resultRef.current) {
      resultRef.current.focus({ preventScroll: true });
      resultRef.current.scrollIntoView?.({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  }, [result, view]);

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
          revision,
          request: lastRequest,
          mode,
          builder: formal,
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
    revision,
    lastRequest,
    mode,
    title,
    qName,
    focus,
    style,
    gear,
    pax,
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
        site: refine
          ? retainQContext(ao, prompt, site)
          : withLocalAO(ao, prompt, site),
        minutes: 45,
        equipment:
          refine && lastRequest
            ? lastRequest.equipment
            : mode === "formal"
              ? gear.includes("Coupon")
                ? "Coupon"
                : gear.length
                  ? "From prompt"
                  : "None"
              : equipment,
        running: refine && lastRequest ? lastRequest.running : running,
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
    if (refine) {
      const changes = resolveRequest({
        ...request.data,
        equipment: "From prompt",
        running: "From prompt",
      });
      if (changes.equipment !== "From prompt")
        request.data.equipment = changes.equipment;
      if (changes.running !== "From prompt")
        request.data.running = changes.running;
    }
    const resolved = resolveRequest(request.data);
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
      if (result && next.provider === "Template")
        throw Error(
          next.fallbackReason ??
            "Free AI could not make a new draft. Your current draft is unchanged. Use the offline template button if you want to replace it.",
        );
      workoutSchema.parse(next.workout);
      if (sequence !== epoch.current) return;
      setResult(next);
      setView("review");
      setLastRequest(resolved);
      onDraft?.(next.workout);
      if (next.workout.provenance.ao) setAO(next.workout.provenance.ao);
      setMinutes(next.workout.duration ?? minutes);
      setMary(next.plan.sections.some((s) => s.kind === "mary"));
      setSaved(false);
      setRevision("");
    } catch (e) {
      if (
        sequence === epoch.current &&
        !refine &&
        !result &&
        !abort.signal.aborted
      ) {
        const next = fallbackPlan(request.data);
        next.fallbackReason =
          e instanceof Error
            ? e.message.slice(0, 500)
            : "Free AI could not complete this request.";
        setResult(next);
        setView("review");
        setLastRequest(resolved);
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
      <div hidden={view === "review"} className="planner-build">
        <div className="assistant-intro">
          <p className="eyebrow">THE FE / Q PLANNER</p>
          <h1>Build your next Q.</h1>
          <p className="assistant-subhead">Bring an idea. Leave with a plan.</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(false);
          }}
        >
          <div className="planner-idea">
            <div className="entry-modes" aria-label="Choose how to build">
              <button
                type="button"
                disabled={busy}
                aria-pressed={mode === "idea"}
                onClick={() => setMode("idea")}
              >
                Enter an Idea
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={mode === "formal"}
                onClick={() => setMode("formal")}
              >
                Formal Builder
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
                <p>
                  Available gear · select only what you can bring or confirm
                </p>
                <div className="gear-options">
                  {GEAR.map((g) => (
                    <label className="checkbox" key={g}>
                      <input
                        type="checkbox"
                        checked={gear.includes(g)}
                        onChange={() => {
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
              {mode === "formal"
                ? "Additional instructions (optional)"
                : "Describe your Q"}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={1800}
                rows={3}
                disabled={busy}
                placeholder={
                  mode === "formal"
                    ? "Any specific exercises, theme, or special instructions..."
                    : GOLD_RUSH_EXAMPLE
                }
              />
            </label>
            <div className="prompt-inspiration-bar">
              <button
                type="button"
                className="example-prompt"
                disabled={busy}
                onClick={() => setPrompt(GOLD_RUSH_EXAMPLE)}
              >
                Try the Gold Rush idea
              </button>
              <button type="button" disabled={busy} onClick={surprise}>
                Surprise Me!
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
                      site: withLocalAO(ao, prompt, site),
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
                    setView("review");
                    setLastRequest(resolveRequest(request.data));
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
                    setError(
                      "Generation stopped. Your previous draft is safe.",
                    );
                  }}
                >
                  Cancel generation
                </button>
              )}
            </div>
            <div className="planner-location">
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
                  if (matched)
                    setStartTime(matched.sessions[0]?.time ?? "05:30");
                }}
              />
            </div>

            <details className="assistant-preferences">
              <summary>
                Session preferences <span>45-minute FE schedule</span>
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
                      setEquipment(
                        e.target.value as PlannerRequest["equipment"],
                      )
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
                      setRunning(e.target.value as PlannerRequest["running"])
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
              Your idea, site details and current draft go to our free AI
              providers. Other saved workouts are not sent. Offline templates
              work without AI.
            </p>
          </div>
        </form>
      </div>
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
      {view === "build" && result && (
        <button type="button" onClick={() => setView("review")}>
          Return to current draft
        </button>
      )}
      {view === "review" && result && (
        <PlannerDraft
          result={result}
          resultRef={resultRef}
          busy={busy}
          saved={saved}
          setSaved={setSaved}
          revision={revision}
          setRevision={setRevision}
          ask={ask}
          onSave={onSave}
          onLead={onLead}
          onEdit={onEdit}
          onPreview={onPreview}
          onReference={onReference}
          onSetup={() => setView("build")}
        />
      )}
    </section>
  );
}
