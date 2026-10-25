import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import { catalogEnvironment } from "./server/ao-intelligence.ts";
import { plannerDevApi } from "./server/planner-dev.ts";

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Reuse only the two already-public browser settings from our deploy config.
  // Never inject server credentials or the rest of the environment into Vite.
  const define: Record<string, string> = {};
  if (command === "serve" && mode !== "test") {
    const deployConfig = readFileSync(
      new URL("./netlify.toml", import.meta.url),
      "utf8",
    );
    for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
      const value =
        env[name] ??
        deployConfig.match(new RegExp(`^${name} = "([^"]+)"`, "m"))?.[1];
      if (value) define[`import.meta.env.${name}`] = JSON.stringify(value);
    }
  }
  return {
    test: { setupFiles: ["./tests/setup.ts"] },
    define,
    plugins: [
      plannerDevApi({
        catalog: catalogEnvironment("dev", (name) => env[name]),
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
      }),
    ],
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: [".run.app", ".usercontent.goog"],
    },
  };
});
