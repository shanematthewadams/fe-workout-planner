import { handleExicon } from "./exicon-intelligence.ts";
import { handleAOIntelligence } from "./ao-intelligence.ts";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePlanner, MAX_PLANNER_BODY_BYTES } from "./planner-handler.ts";
import { isVerifiedFreeGeminiKey } from "./provider-policy.ts";
import type { AIEnvironment } from "./planner-service.ts";

/** The Studio/Vite preview uses the production handler, never a second generator. */
export function plannerDevApi(env: AIEnvironment = {}): Plugin {
  const callers = new Map<string, { count: number; reset: number }>();
  const settings = {
    ...env,
    GEMINI_FREE_TIER_CONFIRMED: isVerifiedFreeGeminiKey(env.GEMINI_API_KEY)
      ? "true"
      : "false",
  };
  const error = (res: ServerResponse, status: number, message: string) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ error: message }));
  };
  async function serve(req: IncomingMessage, res: ServerResponse) {
    const catalogRead = ["/api/ao-intelligence", "/api/exicon"].includes(
      req.url?.split("?")[0] ?? "",
    );
    const now = Date.now(),
      ip = req.socket.remoteAddress ?? "preview";
    for (const [key, value] of callers)
      if (value.reset <= now) callers.delete(key);
    const caller = callers.get(ip) ?? { count: 0, reset: now + 60000 };
    if (
      !catalogRead &&
      (caller.count >= 5 || (!callers.has(ip) && callers.size >= 1000))
    ) {
      error(res, 429, "Free AI has reached its current limit. Try later.");
      return;
    }
    if (!catalogRead) {
      caller.count++;
      callers.set(ip, caller);
    }
    // Studio terminates HTTPS at its reverse proxy. Preserve that external origin.
    const first = (v: string | string[] | undefined) =>
      (Array.isArray(v) ? v[0] : v)?.split(",")[0].trim();
    const host =
      first(req.headers["x-forwarded-host"]) ?? req.headers.host ?? "localhost";
    const proto =
      first(req.headers["x-forwarded-proto"]) === "https" ? "https" : "http";
    const url = new URL(req.url ?? "/api/plan-workout", `${proto}://${host}`);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined)
        headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    // Bound Node request buffering too; oversized bodies never reach a provider.
    const chunks: Buffer[] = [];
    let length = 0;
    if (req.method !== "GET" && req.method !== "HEAD") {
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += part.length;
        if (length > MAX_PLANNER_BODY_BYTES) {
          error(res, 413, "Request is too large.");
          req.resume();
          return;
        }
        chunks.push(part);
      }
    }
    const controller = new AbortController();
    res.once("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const request = new Request(url, {
      method: req.method,
      headers,
      signal: controller.signal,
      ...(req.method !== "GET" && req.method !== "HEAD"
        ? { body: Buffer.concat(chunks) }
        : {}),
    });
    const response =
      url.pathname === "/api/ao-intelligence"
        ? await handleAOIntelligence(request, settings.catalog ?? {})
        : url.pathname === "/api/exicon"
          ? await handleExicon(request, settings.exicon ?? {})
          : await handlePlanner(request, settings);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }
  return {
    name: "fe-planner-preview-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (
          ![
            "/api/plan-workout",
            "/api/ao-intelligence",
            "/api/exicon",
          ].includes(req.url?.split("?")[0] ?? "")
        ) {
          next();
          return;
        }
        void serve(req, res).catch(() => {
          if (!res.headersSent)
            error(
              res,
              500,
              "The planner is unavailable. Try the offline template.",
            );
          else res.end();
        });
      });
    },
  };
}
