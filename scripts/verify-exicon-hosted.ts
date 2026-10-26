/** Read-only public catalog/RLS verification. Mutations target no rows; no secrets required. */
import { writeFileSync, mkdirSync } from "node:fs";
import { buildAppExicon, EXICON_TABLE_KEYS } from "./exicon-catalog.ts";
const url = process.env.AO_CATALOG_URL,
  key = process.env.AO_CATALOG_PUBLISHABLE_KEY;
if (!url || !key?.startsWith("sb_publishable_"))
  throw Error("Set approved catalog URL and publishable key");
const target = new URL(url);
if (
  target.protocol !== "https:" ||
  target.username ||
  target.password ||
  (target.hostname === "kitqovhdwzkhpxlepvfn.supabase.co" &&
    process.env.AO_CATALOG_ALLOW_SHARED !== "true")
)
  throw Error("Shared target needs explicit operator opt-in");
const catalog = buildAppExicon();
const results: unknown[] = [];
for (const [table, keys] of Object.entries(EXICON_TABLE_KEYS)) {
  if (table === "ao_sources") continue;
  const headers = { apikey: key, "content-type": "application/json" };
  const endpoint = new URL("/rest/v1/" + table, target);
  endpoint.searchParams.set("select", "*");
  const response = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`${table} read failed: ${response.status}`);
  const rows = (await response.json()) as Record<string, unknown>[];
  const expected = catalog[table as keyof typeof EXICON_TABLE_KEYS];
  if (rows.length !== expected.length)
    throw Error(`${table}: expected ${expected.length}, found ${rows.length}`);
  // Actual contents, not just successful SELECT/counts. Ignore the DB-generated alias column.
  for (const row of expected) {
    const wanted = row as Record<string, unknown>;
    const match = rows.find((r) => keys.every((k) => r[k] === wanted[k]));
    if (
      !match ||
      Object.entries(wanted).some(([k, v]) =>
        /_at$/.test(k) && v
          ? Date.parse(String(match[k])) !== Date.parse(String(v))
          : JSON.stringify(match[k]) !== JSON.stringify(v),
      )
    )
      throw Error(`${table}: content mismatch`);
  }
  const filtered = new URL(endpoint);
  filtered.searchParams.set(
    keys[0],
    "eq.__nonexistent_exicon_permission_probe__",
  );
  const denied: Record<string, number> = {};
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const result = await fetch(method === "POST" ? endpoint : filtered, {
      method,
      headers,
      body:
        method === "POST"
          ? JSON.stringify(
              rows[0]
                ? Object.fromEntries(
                    Object.entries(rows[0]).filter(
                      ([k]) => k !== "normalized_alias",
                    ),
                  )
                : {},
            )
          : method === "PATCH"
            ? JSON.stringify({
                [keys[0]]: "__nonexistent_exicon_permission_probe__",
              })
            : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (![401, 403].includes(result.status))
      throw Error(`${table} ${method}: expected denial, got ${result.status}`);
    denied[method] = result.status;
  }
  results.push({ table, rows: rows.length, contentMatches: true, denied });
}
mkdirSync("qa/exicon", { recursive: true });
writeFileSync(
  "qa/exicon/hosted-verification.json",
  JSON.stringify(
    {
      target: target.hostname,
      checkedAt: new Date().toISOString(),
      roles: ["anon"],
      results,
      authenticatedHttp: "not exercised; SQL role verified separately",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    tables: results.length,
    content: "matches",
    anonymousMutationsDenied: results.length * 3,
  }),
);
