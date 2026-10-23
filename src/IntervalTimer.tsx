import { useAccount } from "./AccountContext";
import { scopedDraftKey } from "./auth";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppIcon } from "./AppIcon";
import type { Workout } from "./model";
import {
  TABATA,
  intervalElapsed,
  intervalPhase,
  intervalSettingsSchema,
  intervalTotal,
  timerLabel,
  type IntervalState,
} from "./interval-timer";
import {
  playCadenceBeep,
  playCountdownPip,
  playSectionWhistle,
} from "./utils/sound";
import { cancelTimerVoice, type SoundMode } from "./utils/timer-voice";
import { intervalVoiceCue } from "./interval-voice";
import { useWakeLock } from "./useWakeLock";

function restore(key: string, revision: string, date: string) {
  const fresh: IntervalState = {
    settings: { ...TABATA },
    elapsed: 0,
    anchor: null,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    const settings = intervalSettingsSchema.safeParse(raw?.settings);
    if (
      raw?.date === date &&
      raw.revision === revision &&
      settings.success &&
      Number.isFinite(raw.elapsed) &&
      raw.elapsed >= 0 &&
      (raw.anchor === null ||
        (Number.isFinite(raw.anchor) &&
          raw.anchor >= 0 &&
          raw.anchor <= Date.now()))
    ) {
      const state = {
        settings: settings.data,
        elapsed: raw.elapsed,
        anchor: raw.anchor,
      };
      return {
        timer: {
          ...state,
          elapsed: intervalElapsed(state, Date.now()),
          anchor: null,
        },
        recovered: intervalElapsed(state, Date.now()) > 0,
      };
    }
  } catch {
    /* Workout remains readable if recovery is unavailable. */
  }
  return { timer: fresh, recovered: false };
}
const formValues = (s: IntervalState["settings"]) => ({
  work: String(s.work),
  rest: String(s.rest),
  rounds: String(s.rounds),
  prepare: String(s.prepare),
});
export function IntervalTimer({
  workout,
  soundMode,
  speak,
  soundControls,
  audioNotice,
  onRunning,
  focused,
  onFocus,
}: {
  workout: Workout;
  soundMode: SoundMode;
  speak: (text: string) => void;
  soundControls: ReactNode;
  audioNotice: string;
  onRunning: (value: boolean) => void;
  focused: boolean;
  onFocus: (value: boolean) => void;
}) {
  const key = scopedDraftKey(
    `fe-interval-timer:v1:${workout.id}`,
    useAccount()?.user?.id,
  );
  const date = new Date().toLocaleDateString("en-CA");
  const [initial] = useState(() => restore(key, workout.updatedAt, date));
  const [timer, setTimer] = useState<IntervalState>(initial.timer);
  const [values, setValues] = useState(() =>
    formValues(initial.timer.settings),
  );
  const [custom, setCustom] = useState(
    () =>
      initial.timer.settings.work !== 20 ||
      initial.timer.settings.rest !== 10 ||
      initial.timer.settings.rounds !== 8 ||
      initial.timer.settings.prepare !== 10,
  );
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) panel.current?.focus();
  }, [focused]);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const candidate = intervalSettingsSchema.safeParse(
    Object.fromEntries(
      Object.entries(values).map(([k, v]) => [
        k,
        v.trim() === "" ? NaN : Number(v),
      ]),
    ),
  );
  const settings =
    timer.elapsed === 0 && timer.anchor === null && candidate.success
      ? candidate.data
      : timer.settings;
  const elapsed = intervalElapsed(timer, now);
  const phase = intervalPhase(settings, elapsed);
  const total = intervalTotal(settings);
  const running = timer.anchor !== null;
  const latest = useRef(timer);
  latest.current = timer;
  useEffect(() => {
    const pauseForExit = () => {
      const current = latest.current;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            ...current,
            elapsed: intervalElapsed(current, Date.now()),
            anchor: null,
            date,
            revision: workout.updatedAt,
          }),
        );
      } catch {
        /* Keep the workout usable. */
      }
    };
    const leavePage = () => {
      cancelTimerVoice();
      pauseForExit();
      const current = latest.current;
      const paused = {
        ...current,
        elapsed: intervalElapsed(current, Date.now()),
        anchor: null,
      };
      latest.current = paused;
      setTimer(paused);
    };
    window.addEventListener("pagehide", leavePage);
    return () => {
      window.removeEventListener("pagehide", leavePage);
      pauseForExit();
    };
  }, [key, date, workout.updatedAt]);
  const canEdit = !running && timer.elapsed === 0;
  const voicePrior = useRef({ elapsed, mode: soundMode });
  const speakRef = useRef(speak);
  speakRef.current = speak;
  useEffect(() => () => cancelTimerVoice(), []);
  const prior = useRef({ key: phase.key, seconds: Math.ceil(phase.remaining) });
  const wakeNotice = useWakeLock(running);
  useEffect(() => {
    onRunning(running);
  }, [running, onRunning]);
  useEffect(() => () => onRunning(false), [onRunning]);
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const visible = () => {
      const current = intervalPhase(
        timer.settings,
        intervalElapsed(timer, Date.now()),
      );
      prior.current = {
        key: current.key,
        seconds: Math.ceil(current.remaining),
      };
      voicePrior.current = {
        ...voicePrior.current,
        elapsed: intervalElapsed(timer, Date.now()),
      };
      if (document.visibilityState !== "visible") cancelTimerVoice();
      tick();
    };
    const id = setInterval(tick, 100);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [running, timer]);
  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ ...timer, date, revision: workout.updatedAt }),
      );
    } catch {
      setStorageError(
        "Interval recovery is unavailable. Keep this screen open.",
      );
    }
  }, [key, timer, date, workout.updatedAt]);
  useEffect(() => {
    const seconds = Math.ceil(phase.remaining);
    if (
      running &&
      soundMode === "beeps" &&
      document.visibilityState === "visible"
    ) {
      if (prior.current.key !== phase.key) {
        if (phase.stage === "Complete") playSectionWhistle();
        else if (phase.stage === "Work") playCountdownPip(true);
        else if (phase.stage === "Rest") playCadenceBeep(440, 0.25);
      } else if (
        seconds >= 1 &&
        seconds <= 3 &&
        prior.current.seconds > seconds
      )
        playCountdownPip();
    }
    if (
      running &&
      soundMode === "voice" &&
      voicePrior.current.mode === "voice" &&
      document.visibilityState === "visible"
    ) {
      const cue = intervalVoiceCue(
        settings,
        voicePrior.current.elapsed,
        timer.elapsed +
          (timer.anchor === null
            ? 0
            : Math.max(0, (now - timer.anchor) / 1000)),
      );
      if (cue) speakRef.current(cue);
    }
    voicePrior.current = { elapsed, mode: soundMode };
    prior.current = { key: phase.key, seconds };
    if (elapsed >= total && running)
      setTimer((t) => ({ ...t, elapsed: total, anchor: null }));
  }, [
    phase.key,
    phase.stage,
    phase.remaining,
    elapsed,
    total,
    running,
    soundMode,
    settings,
  ]);
  function start() {
    if (!candidate.success && timer.elapsed === 0) {
      setError(
        "Set work to 1–300 seconds, rest to 0–300, rounds to 1–100, and get ready to 0–60. Keep the set to 60 minutes or less.",
      );
      return;
    }
    setError("");
    onFocus(true);
    const timestamp = Date.now();
    setNow(timestamp);
    cancelTimerVoice();
    if (soundMode === "beeps") playCadenceBeep();
    if (soundMode === "voice") {
      const s =
        timer.elapsed === 0 && candidate.success
          ? candidate.data
          : timer.settings;
      const current = intervalPhase(s, intervalElapsed(timer, timestamp));
      speak(
        timer.elapsed > 0
          ? "Resumed"
          : current.stage === "Get ready"
            ? "Get ready"
            : "Go",
      );
    }
    setTimer((t) => ({
      ...t,
      settings:
        t.elapsed === 0 && candidate.success ? candidate.data : t.settings,
      anchor: timestamp,
    }));
  }
  function pause() {
    cancelTimerVoice();
    const timestamp = Date.now();
    setNow(timestamp);
    setTimer((t) => ({
      ...t,
      elapsed: intervalElapsed(t, timestamp),
      anchor: null,
    }));
  }
  const nextPhase = intervalPhase(
    settings,
    Math.min(total, elapsed + phase.remaining + 0.001),
  );
  return (
    <section
      ref={panel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onFocus(false);
        if (
          event.code === "Space" &&
          event.target === event.currentTarget &&
          phase.stage !== "Complete"
        ) {
          event.preventDefault();
          if (!event.repeat) {
            if (running) pause();
            else start();
          }
        }
      }}
      className={`interval-clock interval-${phase.stage.toLowerCase().replace(" ", "-")}`}
      aria-label="Interval timer"
    >
      <div className="interval-toolbar">
        <span className="eyebrow">
          {settings.work === 20 && settings.rest === 10
            ? "TABATA"
            : "INTERVALS"}{" "}
          / {settings.rounds} ROUNDS
        </span>
        <div>
          {focused && soundControls}
          <button aria-pressed={focused} onClick={() => onFocus(!focused)}>
            {focused ? "Exit focus" : "Focus timer"}
          </button>
        </div>
      </div>
      <div className="interval-setup">
        <label>
          Interval style
          <select
            aria-label="Interval style"
            disabled={!canEdit}
            value={
              custom ? "custom" : settings.work === 40 ? "steady" : "tabata"
            }
            onChange={(e) => {
              const next = e.target.value === "custom";
              setCustom(next);
              setError("");
              if (!next) {
                const preset =
                  e.target.value === "steady"
                    ? { work: 40, rest: 20, rounds: 8, prepare: 10 }
                    : TABATA;
                setValues(formValues(preset));
                setTimer({ settings: { ...preset }, elapsed: 0, anchor: null });
              }
            }}
          >
            <option value="tabata">Tabata · 20s work / 10s rest × 8</option>
            <option value="steady">40 / 20 · 8 rounds</option>
            <option value="custom">Custom intervals</option>
          </select>
        </label>
        {custom && (
          <div className="interval-fields">
            {(
              [
                ["work", "Work (seconds)", 1, 300],
                ["rest", "Rest (seconds)", 0, 300],
                ["rounds", "Rounds", 1, 100],
                ["prepare", "Get ready (seconds)", 0, 60],
              ] as const
            ).map(([k, label, min, max]) => (
              <label key={k}>
                {label}
                <input
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  step={1}
                  disabled={!canEdit}
                  value={values[k]}
                  onChange={(e) => {
                    setValues({ ...values, [k]: e.target.value });
                    setError("");
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </div>
      <p className="interval-summary">
        {settings.rounds} rounds · {settings.work}s work / {settings.rest}s rest
        · {timerLabel((settings.work + settings.rest) * settings.rounds)} +{" "}
        {settings.prepare}s get ready
      </p>
      <div className="interval-display">
        <h2 className="timer-stage" aria-live="polite">
          {phase.stage}
        </h2>
        <div
          className="field-clock"
          role="timer"
          aria-label="Interval time remaining"
        >
          {timerLabel(phase.remaining)}
        </div>
        <p className="interval-round">
          {phase.stage === "Get ready"
            ? "First round up next"
            : `Round ${phase.round} of ${settings.rounds}`}
          {!running && timer.elapsed > 0 && phase.stage !== "Complete"
            ? " · Paused"
            : ""}
        </p>
        <p className="interval-next">
          {phase.stage === "Complete"
            ? "Nice work. Take a breath."
            : `Next: ${nextPhase.stage === "Complete" ? "Set complete" : `${nextPhase.stage} · ${timerLabel(nextPhase.remaining)}`}`}
        </p>
      </div>
      <div className="interval-totals">
        <span>{timerLabel(total - elapsed)} remaining</span>
        <span>{Math.floor((elapsed / total) * 100)}% complete</span>
      </div>
      <progress
        aria-label="Interval set progress"
        value={elapsed}
        max={total}
      />
      <div className="actions">
        {running ? (
          <button
            className="create"
            onClick={(event) => {
              if (event.detail <= 1) pause();
            }}
          >
            <AppIcon name="pause" />
            Pause intervals
          </button>
        ) : (
          <button
            className="create"
            disabled={phase.stage === "Complete"}
            onClick={(event) => {
              if (event.detail <= 1) start();
            }}
          >
            <AppIcon name="play" />
            {timer.elapsed > 0 ? "Resume intervals" : "Start intervals"}
          </button>
        )}
        <button
          onClick={() => {
            if (timer.elapsed > 0 || running) {
              if (!confirm("Reset this interval set?")) return;
            }
            cancelTimerVoice();
            onFocus(false);
            setNow(Date.now());
            setTimer((t) => ({ ...t, elapsed: 0, anchor: null }));
            prior.current = { key: "prepare", seconds: timer.settings.prepare };
            setError("");
          }}
        >
          <AppIcon name="reset" />
          Reset intervals
        </button>
      </div>
      {focused && audioNotice && (
        <p className="timer-audio-status" role="status">
          {audioNotice}
        </p>
      )}
      {phase.stage === "Complete" && (
        <p role="status">Set complete. Reset to go again.</p>
      )}
      {initial.recovered &&
        timer.elapsed > 0 &&
        !running &&
        phase.stage !== "Complete" && (
          <p className="muted">
            Recovered a paused interval set. Resume when you’re ready.
          </p>
        )}
      <div className="interval-help">
        {!canEdit && (
          <p className="muted">Reset the set to change its intervals.</p>
        )}
        <p className="muted">
          An interval set has its own clock and does not change your workout
          schedule. The last round includes its rest period.
        </p>
        <p className="muted">
          Voice: halfway, five seconds to stop, three seconds to go. Halfway is
          skipped for work under 12 seconds. Beeps use distinct work/rest cues.
          Space pauses or resumes when the timer is focused.
        </p>
      </div>
      {error && (
        <p role="alert" className="assistant-error">
          {error}
        </p>
      )}
      {wakeNotice && <p role="status">{wakeNotice}</p>}
      {storageError && <p role="alert">{storageError}</p>}
    </section>
  );
}
