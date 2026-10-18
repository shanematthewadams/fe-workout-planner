import { useState } from "react";
import type { Workout } from "./model";
import { SessionTimer } from "./SessionTimer";
import { IntervalTimer } from "./IntervalTimer";
import { playCadenceBeep } from "./utils/sound";
export { elapsedAt, liveTimer } from "./SessionTimer";

export function FieldTimer({
  workout,
  onExit,
}: {
  workout: Workout;
  onExit: () => void;
}) {
  const [mode, setMode] = useState<"off" | "session" | "intervals">("off");
  const [sound, setSound] = useState(false);
  const [running, setRunning] = useState(false);
  return (
    <main id="main" className="main field-timer lead-view">
      <div className="lead-top">
        <button onClick={onExit}>← Back to plan</button>
        {mode !== "off" && (
          <button
            aria-pressed={sound}
            onClick={() => {
              if (!sound) playCadenceBeep();
              setSound(!sound);
            }}
          >
            {sound ? "Sounds on" : "Enable sounds"}
          </button>
        )}
      </div>
      <p className="eyebrow">LEAD YOUR Q</p>
      <h1 className="lead-workout-title">{workout.title}</h1>
      <div
        className="lead-timer-options"
        role="group"
        aria-label="Optional timer"
      >
        {(
          [
            ["off", "No timer"],
            ["session", "Session timer"],
            ["intervals", "Intervals"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={mode === key}
            disabled={running && mode !== key}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {running && <p className="muted">Pause before switching timer modes.</p>}
      {mode === "session" && (
        <SessionTimer workout={workout} sound={sound} onRunning={setRunning} />
      )}
      {mode === "intervals" && (
        <IntervalTimer workout={workout} sound={sound} onRunning={setRunning} />
      )}
      {mode !== "off" && (
        <p className="timer-audio-note">
          Sounds are optional. Keep this screen open and your phone’s volume up
          for cues; locked phones can silence browser audio.
        </p>
      )}
      {mode === "off" ? (
        <p className="muted">
          Your plan, ready to lead. Turn on a timer whenever you need one.
        </p>
      ) : null}
      <details className="lead-plan-panel" open={mode === "off"}>
        <summary>Workout sheet</summary>
        <section className="lead-workout" aria-label="Workout to lead">
          {workout.sections.map((section) => (
            <details key={section.id} open={section.kind === "thang"}>
              <summary>{section.title}</summary>
              {section.blocks.map((block) => (
                <article key={block.id}>
                  <h3>{block.title}</h3>
                  {block.instructions && (
                    <p className="import-directions">{block.instructions}</p>
                  )}
                  <ul>
                    {block.exercises.map((exercise) => (
                      <li key={exercise.id}>
                        <strong>
                          {exercise.name} · {exercise.amount}
                          {exercise.unit !== "instructions"
                            ? ` ${exercise.unit}`
                            : ""}
                        </strong>
                        {exercise.instructions && (
                          <p>{exercise.instructions}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </details>
          ))}
          {workout.adaptationNotes && (
            <details>
              <summary>Workout notes</summary>
              <p className="import-directions">{workout.adaptationNotes}</p>
            </details>
          )}
        </section>
      </details>
    </main>
  );
}
