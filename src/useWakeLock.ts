import { useEffect } from "react";

/** Keep a visible running timer awake when supported; release every acquired lock. */
export function useWakeLock(running: boolean) {
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
      if (!navigator.wakeLock) return;
      pending = true;
      navigator.wakeLock
        ?.request("screen")
        .then((value) => {
          if (disposed || document.visibilityState !== "visible")
            void value.release().catch(() => {});
          else lock = value;
        })
        .catch(() => {})
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
}
