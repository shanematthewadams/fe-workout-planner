import { useEffect, useState } from "react";
export function OfflineStatus() {
  const [state, setState] = useState("Preparing offline access…");
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) {
      setState(
        "Offline access is unavailable in this browser. Keep a downloaded backup.",
      );
      return;
    }
    let active = true;
    const check = () =>
      navigator.serviceWorker.controller?.postMessage({
        type: "FE_OFFLINE_CHECK",
      });
    const message = (event: MessageEvent) => {
      if (active && event.data?.type === "FE_OFFLINE_STATUS")
        setState(
          event.data.ready
            ? "Ready offline · changes upload when you reconnect."
            : "Offline setup is incomplete. Keep this page open or download a backup.",
        );
    };
    const failed = () =>
      setState(
        "Offline setup did not finish. Keep this page open or download a backup.",
      );
    navigator.serviceWorker.addEventListener("message", message);
    navigator.serviceWorker.addEventListener("controllerchange", check);
    window.addEventListener("fe-offline-error", failed);
    void navigator.serviceWorker.ready.then(() => {
      if (active) check();
    });
    check();
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("message", message);
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      window.removeEventListener("fe-offline-error", failed);
    };
  }, []);
  if (!import.meta.env.PROD) return null;
  return (
    <p className="offline-status" role="status">
      {state}
    </p>
  );
}
