import { Weinke } from "./Weinke";
import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AppIcon } from "./AppIcon";
import { PlannerWelcome, type WelcomeStep } from "./PlannerWelcome";
import { CONCEPTS, type Vibe } from "./workout-concepts";
import { Dices } from "lucide-react";
import { STYLES, GEAR, fallbackPlan } from "./fallback";
import type { PlannerRequest } from "./planner-contract";
import { findAO } from "./ao-context";
import { withLocalAO, retainQContext } from "./ao-drafts";
import { AOContextPanel } from "./AOContextPanel";
import type { SiteInput } from "./site-contract";
import { workoutSchema, type Workout } from "./model";
import {
  plannerRequestSchema,
  resolveRequest,
  plannerResponseSchema,
  planSchema,
} from "./planner-contract";
import { restorePlannerSession, SESSION_KEY } from "./planner-session";
import { useAccount } from "./AccountContext";
import { scopedDraftKey } from "./auth";
import { PlannerDraft } from "./PlannerDraft";
import { WorkoutDetails } from "./WorkoutDetails";
import { planningDetailsSchema, refinePlanning } from "./planning-details";
export function Planner({
  onEdit,
  onPreview,
  onSave,
  onReference,
  onDraft,
  onLead,
  onImport,
  savedWorkouts = [],
}: {
  savedWorkouts?: Workout[];
  onImport?: () => void;
  onDraft?: (w: Workout) => void;
  onLead?: (w: Workout) => void;
  onEdit: (w: Workout) => void;
  onPreview: (w: Workout) => void;
  onSave: (w: Workout, base?: Workout) => Workout | false;
  onReference: (id: string) => void;
}) {
  const sessionKey = scopedDraftKey(SESSION_KEY, useAccount()?.user?.id);
  const [initial] = useState(() => {
      const restored = restorePlannerSession(sessionKey);
      let wasSavedToDevice = false;
      try {
        wasSavedToDevice =
          JSON.parse(sessionStorage.getItem(sessionKey) ?? "null")
            ?.savedToDevice === true;
      } catch {
        /* Preserve recovered edits. */
      }
      const latest = savedWorkouts.find(
        (w) => w.id === restored.result?.workout.id,
      );
      if (
        restored.result &&
        wasSavedToDevice &&
        latest &&
        latest.updatedAt > restored.result.workout.updatedAt
      ) {
        const plan = planSchema.safeParse({
          ...restored.result.plan,
          title: latest.title,
          summary: latest.summary,
          equipment: latest.equipment,
          running: latest.running,
          format: latest.format,
          sections: latest.sections,
        });
        if (plan.success)
          restored.result = {
            ...restored.result,
            workout: latest,
            plan: plan.data,
          };
      }
      return restored;
    }),
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
  const [welcomeStep, setWelcomeStep] = useState<WelcomeStep>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(sessionKey + ":flow") ?? "null",
      );
      if (
        ["welcome", "vibe", "location", "concept", "ready", "weinke"].includes(
          value?.step,
        )
      )
        return value.step;
    } catch {
      /* Existing draft remains recoverable. */
    }
    return initial.prompt || initial.result ? "ready" : "welcome";
  });
  const [vibe, setVibe] = useState<Vibe>(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(sessionKey + ":flow") ?? "null",
      )?.vibe;
      if (["together", "heavy", "moving", "mix", "surprise"].includes(value))
        return value;
    } catch {
      /* Use the first curated collection. */
    }
    return "together";
  });
  const [extraNote, setExtraNote] = useState(() => {
    try {
      return String(
        JSON.parse(sessionStorage.getItem(sessionKey + ":flow") ?? "null")
          ?.note ?? "",
      ).slice(0, 250);
    } catch {
      return "";
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(
        sessionKey + ":flow",
        JSON.stringify({ step: welcomeStep, note: extraNote, vibe }),
      );
    } catch {
      /* Main session effect reports storage failures. */
    }
  }, [welcomeStep, extraNote, sessionKey, vibe]);
  const saveCallback = useRef(onSave);
  saveCallback.current = onSave;
  const saveBase = useRef<Workout | undefined>(initial.result?.workout);
  const attemptedSave = useRef<Workout | null>(null);
  const [saveError, setSaveError] = useState(false);
  function saveCurrent(workout: Workout) {
    const copy = saveCallback.current(workout, saveBase.current);
    if (!copy) {
      setSaved(false);
      setSaveError(true);
      return false;
    }
    saveBase.current = copy;
    attemptedSave.current = copy;
    setResult((previous) =>
      previous ? { ...previous, workout: copy } : previous,
    );
    setSaved(true);
    setSaveError(false);
    return true;
  }
  useEffect(() => {
    if (!result || busy || attemptedSave.current === result.workout) return;
    attemptedSave.current = result.workout;
    saveCurrent(result.workout);
  }, [result, busy]);
  const [lastRequest, setLastRequest] = useState(initial.request);
  const [mode, setMode] = useState<"idea" | "formal">(initial.mode);
  const [conditions, setConditions] = useState(
    planningDetailsSchema.parse(initial.preferences.planning ?? {}),
  );
  const [focus, setFocus] = useState(
      initial.preferences.planning?.focus ??
        (initial.builder.focus === "Legs"
          ? "Lower body"
          : initial.builder.focus),
    ),
    [style, setStyle] = useState<(typeof STYLES)[number]>(
      initial.builder.style,
    ),
    [gear, setGear] = useState<string[]>(initial.builder.gear),
    [pax, setPax] = useState<number | undefined>(
      initial.preferences.planning
        ? initial.preferences.planning.pax
        : initial.mode === "formal"
          ? initial.builder.pax
          : undefined,
    ),
    [qName, setQName] = useState(initial.builder.qName),
    [title, setTitle] = useState(initial.builder.title);
  const ideaText = [prompt, extraNote].filter(Boolean).join("\n");
  const quickPreferences = resolveRequest({
    prompt:
      ideaText.trim().length >= 3 ? ideaText.slice(0, 1800) : "Build a workout",
    equipment,
    running,
  });
  const sessionEquipment =
    mode === "formal"
      ? gear.includes("Coupon")
        ? "Coupon"
        : "None"
      : quickPreferences.equipment === "From prompt"
        ? "None"
        : quickPreferences.equipment;
  const sessionRunning =
    quickPreferences.running === "From prompt"
      ? "Light"
      : quickPreferences.running;
  const planning = { ...conditions, focus, pax };
  const selectedConcept = CONCEPTS.find((concept) => concept.prompt === prompt);
  const formal = {
    title,
    qName,
    focus,
    style,
    gear: gear as NonNullable<PlannerRequest["builder"]>["gear"],
    terrain: "Use confirmed AO features and today's overrides only",
    pax: pax ?? 12,
  };
  function chooseAO(value: string) {
    setAO(value);
    setSite({ overrides: {}, notes: "" });
    const matched = findAO(value);
    if (matched) {
      setStartTime(matched.sessions[0]?.time ?? "05:30");
      const format = matched.sessions[0]?.format;
      const activity =
        format === "Ruck"
          ? "Ruck"
          : format === "Run / ruck"
            ? "Run"
            : "Bootcamp";
      setConditions((previous) => ({ ...previous, activity }));
      setMary(activity === "Bootcamp");
    }
  }
  function chooseMode(next: "idea" | "formal") {
    flushSync(() => setMode(next));
    const field =
      next === "formal"
        ? document.querySelector<HTMLInputElement>(".formal-builder input")
        : document.getElementById("q-description");
    field?.focus();
  }
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
    const resolvedPreferences = resolveRequest({
      prompt: prompt.trim().length >= 3 ? prompt : "Surprise me",
      equipment,
      running,
      mary,
    });
    const availableGear =
      mode === "formal"
        ? gear
        : resolvedPreferences.equipment === "Coupon"
          ? ["Coupon"]
          : resolvedPreferences.equipment === "None"
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
      running: resolvedPreferences.running,
      mary: resolvedPreferences.mary,
      provider,
      strictSchedule: true,
      planning,
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
      const review =
        resultRef.current.closest(".assistant") ?? resultRef.current;
      review.scrollIntoView?.({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  }, [result?.workout.id, view]);

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
        sessionKey,
        JSON.stringify({
          prompt,
          result,
          savedToDevice: saved,
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
            planning,
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
    saved,
    lastRequest,
    mode,
    title,
    qName,
    focus,
    style,
    gear,
    pax,
    conditions,
  ]);
  async function ask(refine: boolean, override?: unknown) {
    const request = plannerRequestSchema.safeParse(
      override ?? {
        prompt: refine
          ? revision
          : mode === "formal"
            ? `Build ${style}. Focus: ${focus}. PAX: ${pax ?? "Q to confirm"}. ${ideaText}`
            : [prompt, extraNote].filter(Boolean).join("\n"),
        ao,
        startTime,
        site: refine
          ? retainQContext(ao, prompt, site)
          : withLocalAO(
              ao,
              [prompt, extraNote].filter(Boolean).join("\n"),
              site,
            ),
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
              : sessionEquipment,
        running: refine && lastRequest ? lastRequest.running : sessionRunning,
        mary,
        provider,
        strictSchedule: true,
        planning: refine
          ? refinePlanning(lastRequest?.planning ?? planning, revision)
          : planning,
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
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, 55000);
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
            : response.status === 504 || response.status === 408
              ? "Free AI took too long. Your previous draft is safe. Try again or use an offline template."
              : "Free AI is unavailable. Your previous draft is safe. Try again later or use an offline template.";
        throw Error(message);
      }
      const parsed = plannerResponseSchema.safeParse(data);
      if (!parsed.success)
        throw Error(
          "The AI returned an incomplete draft. Your previous draft is safe. Try again.",
        );
      const next = parsed.data;
      if (refine && result)
        next.workout = {
          ...next.workout,
          id: result.workout.id,
          originId: result.workout.originId,
          attribution: result.workout.attribution,
          rawNotes: result.workout.rawNotes,
        };
      if (result && next.provider === "Template")
        throw Error(
          "Free AI could not make a new draft. Your current draft is unchanged. Use the offline template button if you want to replace it.",
        );
      workoutSchema.parse(next.workout);
      if (sequence !== epoch.current) return;
      setResult(next);
      setView("review");
      setLastRequest(resolved);
      if (resolved.planning) {
        setConditions(resolved.planning);
        setFocus(resolved.planning.focus);
        setPax(resolved.planning.pax);
      }
      setSite(
        retainQContext(
          resolved.ao,
          resolved.prompt,
          resolved.site ?? { overrides: {}, notes: "" },
        ),
      );
      onDraft?.(next.workout);
      if (next.workout.provenance.ao) setAO(next.workout.provenance.ao);
      setMinutes(next.workout.duration ?? minutes);
      setMary(next.plan.sections.some((s) => s.kind === "mary"));
      setSaved(false);
      setRevision("");
    } catch (e) {
      const failure =
        e instanceof TypeError
          ? "Could not reach free AI. Your previous draft is safe. Check your connection or use an offline template."
          : e instanceof Error
            ? e.message
            : "Could not make a draft. Your previous draft is safe. Try again.";
      if (
        sequence === epoch.current &&
        !refine &&
        !result &&
        !abort.signal.aborted
      ) {
        const next = fallbackPlan(request.data);
        next.fallbackReason = failure;
        setResult(next);
        setView("review");
        setLastRequest(resolved);
        onDraft?.(next.workout);
        setSaved(false);
        setError("");
      } else if (sequence === epoch.current)
        setError(
          abort.signal.aborted
            ? timedOut
              ? "Free AI took too long. Your previous draft is safe. Try again or use an offline template."
              : "Generation stopped. Your previous draft is safe."
            : failure,
        );
    } finally {
      clearTimeout(timeout);
      if (sequence === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="assistant no-print" aria-label="AI-assisted Q planner">
      <ol
        hidden={view === "build" && welcomeStep !== "ready"}
        className="planner-journey"
        aria-label="Workout planning steps"
      >
        {["Describe", "Review", "Save & lead"].map((label, index) => (
          <li
            key={label}
            aria-current={
              (view === "build" ? 0 : saved ? 2 : 1) === index
                ? "step"
                : undefined
            }
          >
            <span aria-hidden="true">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {view === "build" && (
        <PlannerWelcome
          step={welcomeStep}
          vibe={vibe}
          onStep={setWelcomeStep}
          onVibe={setVibe}
          onConcept={(idea) => {
            setPrompt(idea);
            setWelcomeStep("ready");
          }}
          location={
            <AOContextPanel
              ao={ao}
              prompt={prompt}
              startTime={startTime}
              site={site}
              disabled={busy}
              onTime={setStartTime}
              onSite={setSite}
              onAO={chooseAO}
            />
          }
        />
      )}
      {view === "build" && welcomeStep === "weinke" && (
        <Weinke
          key={sessionKey}
          storageKey={sessionKey + ":weinke"}
          onBack={() => setWelcomeStep("welcome")}
          onSave={onSave}
          onLead={onLead}
        />
      )}
      {welcomeStep === "ready" && (
        <div hidden={view === "review"} className="planner-build">
          <button
            type="button"
            disabled={busy}
            onClick={() => setWelcomeStep("welcome")}
          >
            ← Choose another starting point
          </button>
          <div className="assistant-intro">
            <p className="eyebrow">YOUR NEXT BEATDOWN STARTS HERE</p>
            <h1>Let’s make it yours.</h1>
            <p className="assistant-subhead">
              Turn an idea into an F3 workout you can edit, save, print, and
              lead.
            </p>
            <p className="planner-welcome-note">
              No account needed. Start with what you have in mind.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(false);
            }}
          >
            <div className="planner-idea">
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
                      F3 style
                      <select
                        value={style}
                        onChange={(e) =>
                          setStyle(e.target.value as typeof style)
                        }
                      >
                        {STYLES.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
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
              {selectedConcept && (
                <article className="chosen-concept">
                  <p className="eyebrow">
                    <AppIcon name="builder" /> YOUR STARTING IDEA
                  </p>
                  <h2>{selectedConcept.title}</h2>
                  <p>{selectedConcept.description}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setWelcomeStep("concept")}
                  >
                    Choose another idea
                  </button>
                </article>
              )}
              <div className="assistant-prompt" hidden={!!selectedConcept}>
                <label htmlFor="q-description">
                  {mode === "formal"
                    ? "Additional instructions (optional)"
                    : "Describe your Q"}
                </label>
                <div className="prompt-input-row">
                  <textarea
                    id="q-description"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={1800}
                    rows={3}
                    disabled={busy}
                    placeholder={
                      mode === "formal"
                        ? "Any specific exercises, theme, or special instructions..."
                        : "A partner workout with coupons, less running, and a focus on upper body…"
                    }
                  />
                  <button
                    className="surprise-button"
                    type="button"
                    disabled={busy}
                    onClick={surprise}
                    aria-label="Surprise Me!"
                    title="Surprise Me! Roll a workout idea"
                  >
                    <span className="surprise-icon" aria-hidden="true">
                      <Dices size={30} strokeWidth={1.8} />
                    </span>
                    <span className="surprise-label">Surprise me</span>
                  </button>
                </div>
                {mode === "idea" && !prompt.trim() && (
                  <div className="idea-starter">
                    <span>Not sure what to write?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPrompt(
                          "Gold Rush. Coupons and partners for 12 PAX. No running. A gold-mining theme.",
                        );
                        document.getElementById("q-description")?.focus();
                      }}
                    >
                      Try an example
                    </button>
                  </div>
                )}
              </div>
              <details
                className="planner-location"
                open={!selectedConcept || undefined}
              >
                <summary>
                  <AppIcon name="aos" /> {ao || "AO to confirm"} ·{" "}
                  {startTime || "Start time to confirm"} · Location & time
                </summary>
                <AOContextPanel
                  ao={ao}
                  prompt={prompt}
                  startTime={startTime}
                  site={site}
                  disabled={busy}
                  onTime={setStartTime}
                  onSite={setSite}
                  onAO={chooseAO}
                />
              </details>
              <section
                className="quick-preferences"
                aria-label="Anything else?"
              >
                <h2>Anything else?</h2>
                <fieldset disabled={busy}>
                  <legend>
                    <AppIcon name="exicon" /> Using coupons?
                  </legend>
                  <div className="choice-row">
                    {(
                      [
                        ["Yes", "Coupon"],
                        ["No", "None"],
                      ] as const
                    ).map(([label, value]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={sessionEquipment === value}
                        onClick={() => {
                          setEquipment(value);
                          if (mode === "formal")
                            setGear((previous) =>
                              value === "Coupon"
                                ? [...new Set([...previous, "Coupon"])]
                                : previous.filter((item) => item !== "Coupon"),
                            );
                        }}
                      >
                        <AppIcon name="exicon" />
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset disabled={busy}>
                  <legend>
                    <AppIcon name="running" /> How much running?
                  </legend>
                  <div className="choice-row">
                    {(
                      [
                        ["Lots", "Moderate"],
                        ["Some", "Light"],
                        ["None", "None"],
                      ] as const
                    ).map(([label, value]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={sessionRunning === value}
                        onClick={() => setRunning(value)}
                      >
                        <AppIcon name="running" />
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label>
                  Anything we should know? (Optional)
                  <textarea
                    rows={2}
                    maxLength={250}
                    value={extraNote}
                    disabled={busy}
                    onChange={(e) => setExtraNote(e.target.value)}
                    placeholder="Keep it knee-friendly, give it a ’90s theme…"
                  />
                </label>
              </section>
              <div className="assistant-actions">
                <button
                  className="create"
                  disabled={
                    busy || (mode === "idea" && prompt.trim().length < 3)
                  }
                  type="submit"
                >
                  {busy
                    ? "Working on your Q…"
                    : result
                      ? "Make a new draft"
                      : "Build my workout"}
                </button>
                {
                  <button
                    type="button"
                    onClick={() => {
                      const request = plannerRequestSchema.safeParse({
                        prompt: [
                          prompt.length >= 3 ? prompt : `Build ${style}`,
                          extraNote,
                        ]
                          .filter(Boolean)
                          .join("\n"),
                        ao,
                        startTime,
                        site: withLocalAO(
                          ao,
                          [prompt, extraNote].filter(Boolean).join("\n"),
                          site,
                        ),
                        minutes: 45,
                        equipment:
                          mode === "formal"
                            ? gear.includes("Coupon")
                              ? "Coupon"
                              : gear.length
                                ? "From prompt"
                                : "None"
                            : sessionEquipment,
                        running: sessionRunning,
                        mary,
                        strictSchedule: true,
                        planning,
                        ...(mode === "formal" ? { builder: formal } : {}),
                      });
                      if (!request.success) {
                        setError("Choose a start time and check your details.");
                        return;
                      }
                      epoch.current++;
                      controller.current?.abort();
                      setBusy(false);
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
                }
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

              <WorkoutDetails
                value={planning}
                running={running}
                busy={busy}
                onRunning={setRunning}
                onChange={(next) => {
                  setConditions(next);
                  if (next.activity !== conditions.activity)
                    setMary(next.activity === "Bootcamp");
                  setFocus(next.focus);
                  setPax(next.pax);
                }}
              />
              <details className="assistant-preferences">
                <summary>
                  Session preferences <span>45-minute FE schedule</span>
                </summary>
                <div className="assistant-grid">
                  <p className="schedule-fixed">
                    45-minute physical session
                    <br />
                    {conditions.activity === "Bootcamp" ? (
                      <>
                        2 welcome · 8 warmup ·{" "}
                        {mary ? "29 Thang · 6 Mary" : "35 Thang · Mary skipped"}
                      </>
                    ) : (
                      <>
                        2 welcome ·{" "}
                        {mary
                          ? "37 route · 6 Mary"
                          : "43 route · warmup and Mary skipped"}
                      </>
                    )}
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
              <details className="planner-other-ways">
                <summary>Other ways to start</summary>
                <p>
                  Use the form to choose a workout style and gear, or import a
                  plan you already have.
                </p>
                <div className="entry-modes" aria-label="Choose how to build">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={mode === "idea"}
                    onClick={() => chooseMode("idea")}
                  >
                    <AppIcon name="builder" />
                    Enter an Idea
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={mode === "formal"}
                    onClick={() => chooseMode("formal")}
                  >
                    <AppIcon name="details" />
                    Formal Builder
                  </button>
                </div>
                {onImport && (
                  <p className="import-entry">
                    <strong>Already have a workout?</strong>
                    <span>Bring it here to edit, save, print, and lead.</span>
                    <button type="button" onClick={onImport}>
                      Import a workout
                    </button>
                  </p>
                )}
              </details>
              <p className="assistant-privacy">
                Your idea, workout details, site details and current draft go to
                our free AI providers. Other saved workouts are not sent.
                Offline templates work without AI.
              </p>
            </div>
          </form>
        </div>
      )}
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
          revision={revision}
          setRevision={setRevision}
          ask={ask}
          saveError={saveError}
          onSave={saveCurrent}
          onChange={(next) => {
            setSaved(false);
            setResult(next);
            onDraft?.(next.workout);
          }}
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
