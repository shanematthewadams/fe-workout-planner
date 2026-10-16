import { useEffect, useRef, useState } from "react";
import type { Workout } from "./model";
import { sessionPhases, sessionMatches, clockLabel } from "./session";
import { playCadenceBeep, playSectionWhistle } from "./utils/sound";
type TimerState = {
  elapsed: number;
  anchor: number | null;
  wall: boolean;
  cot: number;
};
export function elapsedAt(state: TimerState, now: number) {
  return Math.min(
    2700 + state.cot * 60,
    Math.max(
      0,
      state.elapsed + (state.anchor === null ? 0 : (now - state.anchor) / 1000),
    ),
  );
}
export function liveTimer(now: number, cot = 10): TimerState {
  const start = new Date(now);
  start.setHours(5, 30, 0, 0);
  return {
    elapsed: Math.min(
      2700 + cot * 60,
      Math.max(0, (now - start.getTime()) / 1000),
    ),
    anchor: Math.max(now, start.getTime()),
    wall: true,
    cot,
  };
}
export function FieldTimer({
  workout,
  onExit,
}: {
  workout: Workout;
  onExit: () => void;
}) {
  const key = "fe-field-timer:v1:" + workout.id;
  const [timer, setTimer] = useState<TimerState>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        raw &&
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
    [sound, setSound] = useState(true),
    [cadence, setCadence] = useState(false),
    [beat, setBeat] = useState(0),
    [bpm, setBpm] = useState(80),
    [storageError, setStorageError] = useState("");
  const elapsed = elapsedAt(timer, now),
    total = 2700 + timer.cot * 60;
  const phases = sessionPhases(
    workout.sections.some((s) => s.kind === "mary"),
    timer.cot,
  );
  const phase =
    phases.find((p) => elapsed < p.end) ?? phases[phases.length - 1];
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
      localStorage.setItem(key, JSON.stringify(timer));
    } catch {
      setStorageError("Timer recovery unavailable. Keep this screen open.");
    }
  }, [key, timer]);
  useEffect(() => {
    if (
      timer.anchor !== null &&
      sound &&
      phases.some((p) => previous.current < p.end && elapsed >= p.end)
    )
      playSectionWhistle();
    previous.current = elapsed;
    if (elapsed >= 2700) setCadence(false);
    if (elapsed >= total && timer.anchor !== null)
      setTimer({ ...timer, elapsed: total, anchor: null });
  }, [elapsed, timer.anchor, sound, phases]);
  useEffect(() => {
    if (!cadence || elapsed >= 2700) return;
    let step = 0;
    const i = setInterval(() => {
      const count = step++;
      setBeat(count);
      if (sound) playCadenceBeep(count % 4 === 3 ? 880 : 550);
    }, 60000 / bpm);
    return () => clearInterval(i);
  }, [cadence, bpm, sound, elapsed >= 2700]);
  useEffect(() => {
    if (timer.anchor === null) return;
    let lock: WakeLockSentinel | undefined;
    const wake = () => {
      if (document.visibilityState === "visible")
        navigator.wakeLock
          ?.request("screen")
          .then((v) => {
            lock = v;
          })
          .catch(() => {});
    };
    wake();
    document.addEventListener("visibilitychange", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      void lock?.release();
    };
  }, [timer.anchor]);
  const update = (next: TimerState) => {
    setNow(Date.now());
    setTimer(next);
  };
  function start(wall: boolean) {
    playCadenceBeep();
    const current = Date.now();
    update(
      wall
        ? liveTimer(current, timer.cot)
        : { ...timer, anchor: current, wall: false },
    );
  }
  const fmt = (n: number) => {
    const seconds = Math.ceil(Math.max(0, n));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  return (
    <main id="main" className="main field-timer">
      <div className="actions">
        <button onClick={onExit}>← Back to plan</button>
        <button aria-pressed={sound} onClick={() => setSound(!sound)}>
          {sound ? "Mute audio" : "Enable audio"}
        </button>
      </div>
      <p className="eyebrow">FIELD Q-TIMER · {workout.title}</p>
      {!sessionMatches(workout) && (
        <p role="alert">
          This plan has different or unknown timing. This timer uses the
          standard 45-minute schedule; review and adjust your work before
          starting.
        </p>
      )}
      <h1>{elapsed >= total ? "COT complete" : phase.name}</h1>
      <p>
        {timer.wall ? "Live 5:30 AM schedule" : "Practice / elapsed time"} ·{" "}
        {clockLabel(phase.start)} – {clockLabel(phase.end)}
      </p>
      <div className="field-clock" role="timer" aria-label="Time remaining">
        {fmt((elapsed < 2700 ? 2700 : total) - elapsed)}
      </div>
      <h2>
        {elapsed >= 2700
          ? "Physical work is over. Circle up."
          : "until the physical hard stop"}
      </h2>
      <progress value={elapsed} max={total} />
      <p>{phase.detail}</p>
      <div className="actions">
        {timer.anchor !== null && elapsed < total ? (
          <button
            className="create"
            disabled={timer.wall}
            onClick={() => {
              update({ ...timer, elapsed, anchor: null });
              setCadence(false);
            }}
          >
            Pause
          </button>
        ) : (
          <>
            <button
              className="create"
              disabled={elapsed >= total}
              onClick={() => start(false)}
            >
              {timer.elapsed ? "Resume" : "Start practice timer"}
            </button>
            <button onClick={() => start(true)}>
              Join live 5:30 AM schedule
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (confirm("Reset this timer?")) {
              setCadence(false);
              update({ elapsed: 0, anchor: null, wall: false, cot: timer.cot });
              previous.current = 0;
            }
          }}
        >
          Reset
        </button>
      </div>
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
              {fmt(p.end - p.start)} · {clockLabel(p.start)}
            </span>
          </div>
        ))}
      </div>
      <section className="cadence">
        <h2>Four-count cadence</h2>
        <p className="cadence-count">
          {cadence
            ? beat % 4 === 3
              ? String(Math.floor(beat / 4) + 1)
              : String((beat % 4) + 1)
            : "1 · 2 · 3 · ONE"}
        </p>
        <label>
          Beats per minute
          <input
            type="range"
            min={40}
            max={140}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          {bpm}
        </label>
        <button
          disabled={elapsed >= 2700}
          aria-pressed={cadence}
          onClick={() => {
            playCadenceBeep();
            setCadence(!cadence);
          }}
        >
          {cadence ? "Stop cadence" : "Start cadence"}
        </button>
        <p>
          Three lead counts, then the group rep. Audio may be suspended when a
          phone locks; keep the timer visible.
        </p>
      </section>
      <section>
        <h2>Lead this phase</h2>
        {workout.sections
          .filter((s) => s.kind === phase.id)
          .flatMap((s) => s.blocks)
          .map((b) => (
            <article className="workout-block" key={b.id}>
              <h3>{b.title}</h3>
              <p>{b.instructions}</p>
              {b.exercises.map((e) => (
                <p key={e.id}>
                  <strong>
                    {e.name} · {e.amount} {e.unit}
                  </strong>
                  <br />
                  {e.instructions} · {e.counting}
                </p>
              ))}
            </article>
          ))}
      </section>
      {storageError && <p role="alert">{storageError}</p>}
    </main>
  );
}
