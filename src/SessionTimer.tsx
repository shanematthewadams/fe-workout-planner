import { useEffect, useRef, useState } from "react";
import type { Workout } from "./model";
import {
  sessionPhases,
  workoutPhases,
  clockLabel,
  sessionStart,
} from "./session";
import { cancelTimerVoice } from "./utils/timer-voice";
import { playCadenceBeep, playSectionWhistle } from "./utils/sound";
import { useWakeLock } from "./useWakeLock";
type TimerState = {
  elapsed: number;
  anchor: number | null;
  wall: boolean;
  cot: number;
};
export function elapsedAt(state: TimerState, now: number, hardStop = 2700) {
  return Math.min(
    hardStop + state.cot * 60,
    Math.max(
      0,
      state.elapsed + (state.anchor === null ? 0 : (now - state.anchor) / 1000),
    ),
  );
}
export function liveTimer(
  now: number,
  cot = 10,
  startTime = "05:30",
  hardStop = 2700,
): TimerState {
  const start = new Date(now);
  const [hours, minutes] = startTime.split(":").map(Number);
  start.setHours(hours, minutes, 0, 0);
  return {
    elapsed: Math.min(
      hardStop + cot * 60,
      Math.max(0, (now - start.getTime()) / 1000),
    ),
    anchor: Math.max(now, start.getTime()),
    wall: true,
    cot,
  };
}
export function SessionTimer({
  workout,
  sound,
  voice,
  onRunning,
}: {
  workout: Workout;
  sound: boolean;
  voice?: (text: string) => void;
  onRunning: (running: boolean) => void;
}) {
  const startMinutes = sessionStart(workout),
    startTime = workout.schedule?.startTime ?? "05:30";
  const today = new Date().toLocaleDateString("en-CA");
  const key = "fe-field-timer:v1:" + workout.id + ":" + startTime;
  const [standard, setStandard] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      return (
        raw?.standard === true &&
        raw.date === today &&
        raw.revision === workout.updatedAt
      );
    } catch {
      return false;
    }
  });
  const [timer, setTimer] = useState<TimerState>(() => {
    // An unknown schedule must never resume into a silently substituted clock.
    if (!workoutPhases(workout) && !standard)
      return { elapsed: 0, anchor: null, wall: false, cot: 10 };
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        raw &&
        (!raw.date || raw.date === today) &&
        (!raw.revision || raw.revision === workout.updatedAt) &&
        Number.isFinite(raw.elapsed) &&
        raw.elapsed >= 0 &&
        (raw.anchor === null || Number.isFinite(raw.anchor)) &&
        [5, 10].includes(raw.cot) &&
        typeof raw.wall === "boolean"
      )
        return raw;
    } catch {
      /* Preserve workout when timer state cannot be read. */
    }
    return { elapsed: 0, anchor: null, wall: false, cot: 10 };
  });
  const [now, setNow] = useState(Date.now),
    [storageError, setStorageError] = useState("");
  const [cursor, setCursor] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        raw?.date === today &&
        raw.revision === workout.updatedAt &&
        typeof raw.cursor?.phase === "string" &&
        Number.isInteger(raw.cursor.index) &&
        raw.cursor.index >= 0
      )
        return raw.cursor as { phase: string; index: number };
    } catch {
      /* The clock remains usable without exercise recovery. */
    }
    return { phase: "", index: 0 };
  });
  const savedPhases = workoutPhases(workout, timer.cot);
  const phases =
    savedPhases ??
    sessionPhases(
      workout.sections.some((s) => s.kind === "mary"),
      timer.cot,
    );
  const hardStop = phases[phases.length - 1].start;
  const elapsed = elapsedAt(timer, now, hardStop),
    total = hardStop + timer.cot * 60;
  const ready = !!savedPhases || standard;
  const phase =
    phases.find((p) => elapsed < p.end) ?? phases[phases.length - 1];
  const phaseExercises = workout.sections
    .filter((s) => s.kind === (phase.sectionKind ?? phase.id))
    .flatMap((s) =>
      s.blocks
        .filter((b) => !phase.blockId || b.id === phase.blockId)
        .flatMap((b) =>
          b.exercises.map((exercise) => ({ exercise, block: b })),
        ),
    );
  const exerciseIndex =
    cursor.phase === phase.id
      ? Math.min(cursor.index, Math.max(0, phaseExercises.length - 1))
      : 0;
  const currentExercise = phaseExercises[exerciseIndex];
  const previous = useRef(elapsed);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const i = setInterval(tick, 250);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(i);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          ...timer,
          cursor,
          standard,
          date: today,
          revision: workout.updatedAt,
        }),
      );
    } catch {
      setStorageError("Timer recovery unavailable. Keep this screen open.");
    }
  }, [key, timer, cursor, standard, today, workout.updatedAt]);
  useEffect(() => {
    if (
      timer.anchor !== null &&
      (sound || voice) &&
      document.visibilityState === "visible" &&
      phases.some((p) => previous.current < p.end && elapsed >= p.end)
    ) {
      if (
        voice &&
        phases.some(
          (p) =>
            previous.current < p.end &&
            elapsed >= p.end &&
            elapsed - p.end <= 0.5,
        )
      )
        voice(elapsed >= total ? "Session complete" : "Next section");
      else if (sound) playSectionWhistle();
    }
    previous.current = elapsed;
    if (elapsed >= total && timer.anchor !== null)
      setTimer({ ...timer, elapsed: total, anchor: null });
  }, [elapsed, timer.anchor, sound, phases]);
  useWakeLock(timer.anchor !== null);
  useEffect(() => {
    onRunning(timer.anchor !== null);
  }, [timer.anchor, onRunning]);
  useEffect(() => () => onRunning(false), [onRunning]);
  const update = (next: TimerState) => {
    if (next.anchor === null) cancelTimerVoice();
    setNow(Date.now());
    setTimer(next);
  };
  function start(wall: boolean) {
    cancelTimerVoice();
    if (voice) voice("Timer started");
    else if (sound) playCadenceBeep();
    const current = Date.now();
    update(
      wall
        ? liveTimer(current, timer.cot, startTime, hardStop)
        : { ...timer, anchor: current, wall: false },
    );
  }
  const fmt = (n: number) => {
    const seconds = Math.ceil(Math.max(0, n));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  return (
    <section className="session-clock" aria-label="Session countdown">
      {!savedPhases && (
        <div role="alert" className="timer-timing-warning">
          <p>
            This plan has incomplete or inconsistent timing. Review the plan, or
            choose the standard 45-minute FE schedule.
          </p>
          {!standard && (
            <button onClick={() => setStandard(true)}>
              Use standard 45-minute timer
            </button>
          )}
        </div>
      )}
      <h2 className="timer-stage">
        {elapsed >= total ? "COT complete" : phase.name}
      </h2>
      <p>
        {timer.wall
          ? `Live ${clockLabel(0, startMinutes)} schedule`
          : "Session countdown"}{" "}
        · {clockLabel(phase.start, startMinutes)} –{" "}
        {clockLabel(phase.end, startMinutes)}
      </p>
      <div className="field-clock" role="timer" aria-label="Time remaining">
        {fmt((elapsed < hardStop ? hardStop : total) - elapsed)}
      </div>
      <h2>
        {elapsed >= hardStop
          ? "Physical work is over. Circle up."
          : "until the physical hard stop"}
      </h2>
      <div className="actions">
        {timer.anchor !== null && elapsed < total ? (
          <button
            className="create"
            onClick={() => {
              update({
                ...timer,
                elapsed: elapsedAt(timer, Date.now(), hardStop),
                anchor: null,
                wall: false,
              });
            }}
          >
            {timer.wall ? "Stop live timer" : "Pause"}
          </button>
        ) : (
          <>
            <button
              className="create"
              disabled={!ready || elapsed >= total}
              onClick={() => start(false)}
            >
              {timer.elapsed ? "Resume" : "Start timer"}
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (confirm("Reset this timer?")) {
              setCursor({ phase: "", index: 0 });
              update({ elapsed: 0, anchor: null, wall: false, cot: timer.cot });
              previous.current = 0;
            }
          }}
        >
          Reset
        </button>
      </div>
      {currentExercise && (
        <section aria-label="Lead this phase">
          <h2>Lead this phase</h2>
          {currentExercise && (
            <article className="workout-block">
              <div className="field-exercise-nav">
                <button
                  disabled={exerciseIndex === 0}
                  onClick={() =>
                    setCursor({ phase: phase.id, index: exerciseIndex - 1 })
                  }
                >
                  Previous
                </button>
                <span>
                  {exerciseIndex + 1} of {phaseExercises.length}
                </span>
                <button
                  disabled={exerciseIndex >= phaseExercises.length - 1}
                  onClick={() =>
                    setCursor({ phase: phase.id, index: exerciseIndex + 1 })
                  }
                >
                  Next exercise
                </button>
              </div>

              <div className="field-exercise" aria-live="polite">
                <strong>
                  {currentExercise.exercise.name} ·{" "}
                  {currentExercise.exercise.amount}{" "}
                  {currentExercise.exercise.unit === "instructions"
                    ? ""
                    : currentExercise.exercise.unit}
                </strong>
                <p>{currentExercise.exercise.instructions}</p>
              </div>
              <details className="field-block-help">
                <summary>
                  {currentExercise.block.title} · block instructions
                </summary>
                <p>{currentExercise.block.instructions}</p>
              </details>
            </article>
          )}
        </section>
      )}
      <progress aria-label="Session progress" value={elapsed} max={total} />
      {!currentExercise && <p>{phase.detail}</p>}
      <details className="field-overview">
        <summary>Schedule & session settings</summary>
        <button
          disabled={!ready || timer.anchor !== null}
          onClick={() => start(true)}
        >
          Join live {clockLabel(0, startMinutes)} schedule
        </button>
        <label>
          COT length
          <select
            disabled={timer.anchor !== null}
            value={timer.cot}
            onChange={(e) => update({ ...timer, cot: Number(e.target.value) })}
          >
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
          </select>
        </label>
        <div className="field-phases">
          {phases.map((p) => (
            <div className={p.id === phase.id ? "active" : ""} key={p.id}>
              <strong>{p.name}</strong>
              <span>
                {fmt(p.end - p.start)} · {clockLabel(p.start, startMinutes)}
              </span>
            </div>
          ))}
        </div>
      </details>
      {storageError && <p role="alert">{storageError}</p>}
    </section>
  );
}
