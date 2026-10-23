/** Short browser speech cues. Never queue commands behind an older cue. */
export type SoundMode = "off" | "beeps" | "voice";
let generation = 0;
let pending: ReturnType<typeof setTimeout> | undefined;
let current: SpeechSynthesisUtterance | undefined;
export function timerVoiceSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis?.speak === "function" &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}
export function cancelTimerVoice() {
  generation++;
  clearTimeout(pending);
  pending = undefined;
  current = undefined;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* Unsupported browser. */
  }
}
export function speakTimerCue(text: string, unavailable: () => void) {
  cancelTimerVoice();
  if (!timerVoiceSupported()) {
    unavailable();
    return;
  }
  const token = generation;
  let started = false;
  const fail = () => {
    if (token !== generation) return;
    cancelTimerVoice();
    unavailable();
  };
  try {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    current = utterance; // Keep it alive until completion/cancellation.
    const voices = synth.getVoices();
    const english = voices.filter((voice) => /^en(?:-|$)/i.test(voice.lang));
    utterance.voice =
      english.find((voice) => voice.localService && voice.default) ??
      english.find((voice) => voice.localService) ??
      english.find((voice) => voice.default) ??
      english[0] ??
      null;
    utterance.lang = utterance.voice?.lang ?? "en-US";
    utterance.rate = 1.25;
    utterance.onstart = () => {
      if (token === generation) {
        started = true;
        clearTimeout(pending);
      }
    };
    utterance.onend = () => {
      if (token === generation) {
        clearTimeout(pending);
        current = undefined;
      }
    };
    utterance.onerror = fail;
    pending = setTimeout(() => {
      if (!started && current === utterance) fail();
    }, 700);
    synth.speak(utterance);
  } catch {
    fail();
  }
}
