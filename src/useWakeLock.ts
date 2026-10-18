import { useEffect } from "react";

/** Keep a visible running timer awake when supported; release every acquired lock. */
export function useWakeLock(running: boolean) {
  useEffect(() => {
    if (!running) return;
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    const wake = () => {
      if (document.visibilityState !== "visible" || lock?.released === false)
        return;
      navigator.wakeLock
        ?.request("screen")
        .then((value) => {
          if (disposed) void value.release();
          else lock = value;
        })
        .catch(() => {});
    };
    wake();
    document.addEventListener("visibilitychange", wake);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", wake);
      void lock?.release();
    };
  }, [running]);
}
