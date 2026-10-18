import type { SoundMode } from "./utils/timer-voice";
export function TimerSoundControls({
  mode,
  supported,
  onChange,
  onPreview,
  running,
}: {
  running: boolean;
  mode: SoundMode;
  supported: boolean;
  onChange: (mode: SoundMode) => void;
  onPreview: () => void;
}) {
  return (
    <div className="timer-sound-controls">
      <label>
        Sound
        <select
          aria-label="Timer sound"
          value={mode}
          onChange={(event) => onChange(event.target.value as SoundMode)}
        >
          <option value="off">Off</option>
          <option value="beeps">Beeps</option>
          <option value="voice" disabled={!supported}>
            Voice{supported ? "" : " (unavailable)"}
          </option>
        </select>
      </label>
      <button
        disabled={mode === "off" || running}
        title={running ? "Pause the timer to preview sounds" : undefined}
        onClick={onPreview}
      >
        Preview sound
      </button>
    </div>
  );
}
