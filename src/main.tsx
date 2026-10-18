import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppRecovery } from "./AppRecovery";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
import "./library.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRecovery>
      <App />
    </AppRecovery>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      window.dispatchEvent(new Event("fe-offline-error"));
    });
  });
}
