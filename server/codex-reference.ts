import {
  codexReferenceSchema,
  type CodexReference,
} from "../src/codex-reference.ts";
import { boundedText } from "./exicon-intelligence.ts";
import type { CatalogEnvironment } from "./ao-intelligence.ts";
/** Successful operator-published reference snapshot only. No Nation fetch or AI in request paths. */
export function createCodexReader(
  fetcher?: typeof fetch,
  now = Date.now,
  timeoutMs = 2000,
) {
  const cache = new Map<string, { expires: number; value: CodexReference }>();
  const pending = new Map<string, Promise<CodexReference | null>>();
  return async (
    env: CatalogEnvironment = {},
  ): Promise<CodexReference | null> => {
    if (
      env.enabled !== "true" ||
      !env.url ||
      !env.publishableKey?.startsWith("sb_publishable_")
    )
      return null;
    let base: URL;
    try {
      base = new URL(env.url);
      if (base.protocol !== "https:" || base.username || base.password)
        return null;
    } catch {
      return null;
    }
    const key = base.origin + ":" + env.publishableKey;
    const saved = cache.get(key);
    if (saved && saved.expires > now()) return saved.value;
    if (pending.has(key)) return pending.get(key)!;
    const work = (async () => {
      try {
        const res = await (fetcher ?? fetch)(
          new URL("/rest/v1/rpc/fe_codex_reference", base),
          {
            headers: { apikey: env.publishableKey! },
            signal: AbortSignal.timeout(timeoutMs),
            redirect: "error",
          },
        );
        if (!res.ok) return null;
        const data = codexReferenceSchema.parse(
          JSON.parse(await boundedText(res, 3_000_000)),
        );
        if (cache.size >= 4) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: now() + 60000, value: data });
        return data;
      } catch {
        return null;
      }
    })();
    pending.set(key, work);
    try {
      return await work;
    } finally {
      pending.delete(key);
    }
  };
}
export const readCodexReference = createCodexReader();
export async function handleCodexReference(
  request: Request,
  env: CatalogEnvironment = {},
  read = readCodexReference,
) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.method !== "GET")
    return new Response(JSON.stringify({ error: "Use GET." }), {
      status: 405,
      headers,
    });
  const reference = await read(env);
  return new Response(
    JSON.stringify({
      version: 1,
      source: reference ? "database" : "unavailable",
      reference,
    }),
    { headers },
  );
}
