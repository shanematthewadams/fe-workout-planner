import { useEffect, useState } from "react";

/** Keep a visible running timer awake when supported; release every acquired lock. */
export function useWakeLock(running: boolean) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    let pending = false;
    const wake = () => {
      if (
        disposed ||
        pending ||
        document.visibilityState !== "visible" ||
        lock?.released === false
      )
        return;
      if (!navigator.wakeLock) {
        setNotice(
          "Keep this screen awake manually; automatic screen wake is unavailable. The timer still works.",
        );
        return;
      }
      pending = true;
      navigator.wakeLock
        ?.request("screen")
        .then((value) => {
          if (disposed || document.visibilityState !== "visible")
            void value.release().catch(() => {});
          else {
            lock = value;
            setNotice("");
          }
        })
        .catch(() => {
          if (!disposed)
            setNotice(
              "Your browser declined to keep the screen awake. Keep it awake manually; the timer still works.",
            );
        })
        .finally(() => {
          pending = false;
        });
    };
    wake();
    document.addEventListener("visibilitychange", wake);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", wake);
      void lock?.release().catch(() => {});
    };
  }, [running]);
  return running ? notice : "";
}
