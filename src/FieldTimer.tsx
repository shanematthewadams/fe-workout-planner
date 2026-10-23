import { useEffect, useState } from "react";
import { AppIcon } from "./AppIcon";
import type { Workout } from "./model";
import { SessionTimer } from "./SessionTimer";
import { IntervalTimer } from "./IntervalTimer";
import { playCadenceBeep } from "./utils/sound";
import { TimerSoundControls } from "./TimerSoundControls";
import {
  cancelTimerVoice,
  speakTimerCue,
  timerVoiceSupported,
  type SoundMode,
} from "./utils/timer-voice";
export { elapsedAt, liveTimer } from "./SessionTimer";

export function FieldTimer({
  workout,
  onExit,
  notice,
}: {
  workout: Workout;
  notice?: React.ReactNode;
  onExit: () => void;
}) {
  const [mode, setMode] = useState<"off" | "session" | "intervals">("off");
  const [soundMode, setSoundMode] = useState<SoundMode>("off");
  const [running, setRunning] = useState(false);
  const [focused, setFocused] = useState(false);
  const [audioNotice, setAudioNotice] = useState("");
  const supported = timerVoiceSupported();
  useEffect(() => {
    // Prime asynchronous voice discovery without starting speech.
    try {
      window.speechSynthesis?.getVoices();
    } catch {
      /* Beeps still work. */
    }
    const hide = () => {
      if (document.visibilityState !== "visible") cancelTimerVoice();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", cancelTimerVoice);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", cancelTimerVoice);
      cancelTimerVoice();
    };
  }, []);
  const speak = (text: string) =>
    speakTimerCue(text, () => {
      setSoundMode("beeps");
      setAudioNotice(
        "Voice is unavailable on this device. Using beeps instead.",
      );
      if (document.visibilityState === "visible") playCadenceBeep();
    });
  const changeSound = (value: SoundMode) => {
    cancelTimerVoice();
    setAudioNotice("");
    setSoundMode(value);
    if (value === "voice") speak("Voice on");
    else if (value === "beeps") playCadenceBeep();
  };
  const preview = () => {
    if (soundMode === "voice") speak("Three, two, one, go");
    else if (soundMode === "beeps") playCadenceBeep();
  };
  const soundControls = (
    <TimerSoundControls
      mode={soundMode}
      supported={supported}
      onChange={changeSound}
      onPreview={preview}
      running={running}
    />
  );
  return (
    <main
      id="main"
      className={`main field-timer lead-view ${focused ? "lead-focused" : ""}`}
    >
      <div className="lead-top">
        <button onClick={onExit}>← Back to plan</button>
        {mode !== "off" && !focused && soundControls}
      </div>
      <p className="eyebrow">LEAD YOUR Q</p>
      <h1 className="lead-workout-title">{workout.title}</h1>
      {notice}
      <details className="lead-timer-disclosure">
        <summary>
          <AppIcon name="timer" /> Timer options
        </summary>
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
              onClick={() => {
                cancelTimerVoice();
                setMode(key);
              }}
            >
              <AppIcon name={key === "off" ? "sheet" : "timer"} />
              {label}
            </button>
          ))}
        </div>
      </details>
      {running && <p className="muted">Pause before switching timer modes.</p>}
      {mode === "session" && (
        <SessionTimer
          workout={workout}
          sound={soundMode === "beeps"}
          voice={soundMode === "voice" ? speak : undefined}
          onRunning={setRunning}
        />
      )}
      {mode === "intervals" && (
        <IntervalTimer
          workout={workout}
          soundMode={soundMode}
          speak={speak}
          soundControls={soundControls}
          audioNotice={audioNotice}
          onRunning={setRunning}
          focused={focused}
          onFocus={setFocused}
        />
      )}
      {audioNotice && !focused && (
        <p className="timer-audio-status" role="status">
          {audioNotice}
        </p>
      )}
      {mode !== "off" && (
        <p className="timer-audio-note">
          Sounds are optional. Keep this screen open and your phone’s volume up
          for cues; locked phones can silence browser audio.
        </p>
      )}
      <details className="lead-plan-panel" open={mode === "off"}>
        <summary>
          <AppIcon name="sheet" />
          Workout sheet
        </summary>
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
                          {exercise.sets ? ` × ${exercise.sets} sets` : ""}
                        </strong>
                        {exercise.counting !== "not applicable" && (
                          <span className="count-label">
                            {exercise.counting}
                          </span>
                        )}
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
          {workout.rawNotes && (
            <details>
              <summary>COT &amp; Q notes</summary>
              <p className="import-directions">{workout.rawNotes}</p>
            </details>
          )}
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
