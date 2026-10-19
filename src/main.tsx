import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AccountWorkspace } from "./AccountContext";
import { AppRecovery } from "./AppRecovery";
import "@fontsource/big-shoulders-display/latin-600";
import "@fontsource/big-shoulders-display/latin-700";
import "@fontsource/big-shoulders-display/latin-800";
import "@fontsource/manrope/latin-400";
import "@fontsource/manrope/latin-600";
import "@fontsource/manrope/latin-700";
import "./style.css";
import "./library.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRecovery>
      <AccountWorkspace>
        <App />
      </AccountWorkspace>
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
