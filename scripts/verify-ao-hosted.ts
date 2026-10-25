/** Read/RLS probe for an explicitly isolated AO catalog. Never targets production.
 * Public/optional synthetic-user credentials come from env and are never logged. */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createAOReader, catalogBaseline } from "../server/ao-intelligence.ts";
const url = process.env.AO_CATALOG_URL;
const ref = process.env.AO_CATALOG_REF;
const key = process.env.AO_CATALOG_PUBLISHABLE_KEY;
if (!url || !ref || !key?.startsWith("sb_publishable_"))
  throw Error("Set the isolated AO_CATALOG_REF, URL and publishable key.");
const target = new URL(url);
if (
  ref === "kitqovhdwzkhpxlepvfn" ||
  target.hostname === "kitqovhdwzkhpxlepvfn.supabase.co" ||
  target.protocol !== "https:" ||
  target.hostname !== ref + ".supabase.co"
)
  throw Error("Refusing production or mismatched target.");
const expected = JSON.parse(
  readFileSync("docs/ao-intelligence/verification.json", "utf8"),
) as { counts: Record<string, number> };
const tokens: { role: string; token?: string }[] = [{ role: "anon" }];
if (process.env.AO_TEST_ACCESS_TOKEN)
  tokens.push({
    role: "authenticated",
    token: process.env.AO_TEST_ACCESS_TOKEN,
  });
const results: unknown[] = [];
for (const { role, token } of tokens) {
  const headers: Record<string, string> = {
    apikey: key,
    "content-type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
  for (const [table, count] of Object.entries(expected.counts)) {
    const endpoint = new URL("/rest/v1/" + table, target);
    endpoint.search = "select=*&limit=1000";
    const response = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw Error(`${role} ${table} read failed (${response.status}).`);
    const rows = (await response.json()) as Record<string, unknown>[];
    if (rows.length !== count)
      throw Error(
        `${table} count mismatch: expected ${count}, found ${rows.length}.`,
      );
    const first = rows[0];
    const primary =
      "id" in first ? "id" : "ao_id" in first ? "ao_id" : "nation_location_id";
    const filtered = new URL("/rest/v1/" + table, target);
    filtered.searchParams.set(primary, "eq." + String(first[primary]));
    // Duplicate INSERT, same-value PATCH and zero-match DELETE cannot alter catalog facts even if misconfigured.
    const mutations: Record<string, number> = {};
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const probe =
        method === "POST"
          ? new URL("/rest/v1/" + table, target)
          : new URL(filtered);
      if (method === "DELETE")
        probe.searchParams.set(
          primary,
          "eq." +
            (primary === "nation_location_id"
              ? "-1"
              : "__nonexistent_permission_probe__"),
        );
      const result = await fetch(probe, {
        method,
        headers,
        body:
          method === "POST"
            ? JSON.stringify(first)
            : method === "PATCH"
              ? JSON.stringify({ [primary]: first[primary] })
              : undefined,
        signal: AbortSignal.timeout(15000),
      });
      if (!(role === "anon" ? [401, 403] : [403]).includes(result.status))
        throw Error(
          `${role} ${table} ${method} must be denied; got ${result.status}. No successful mutation is accepted as a pass.`,
        );
      mutations[method] = result.status;
    }
    results.push({
      role,
      table,
      readCount: rows.length,
      mutations,
    });
  }
}
const reader = createAOReader();
const env = { enabled: "true", url, publishableKey: key };
const south = await reader("fe-ao-south-park", env),
  pretty = await reader("fe-ao-pretty-bird", env),
  bay = await reader("fe-ao-baywatch", env),
  air = await reader("fe-ao-airfield", env),
  mobile = await reader("fe-ao-vagabonds", env);
if (!south || !pretty || !bay || !air || !mobile)
  throw Error("Nested PostgREST relation read failed.");
if (
  !catalogBaseline(south).venueRequired ||
  catalogBaseline(south, "heritage-marina").venue !== "Heritage Park Marina"
)
  throw Error("Seasonal selection mismatch.");
if (catalogBaseline(pretty).features?.shelter?.state === "available")
  throw Error("Nearby garage leaked into on-site shelter.");
if (
  catalogBaseline(bay).venueId !== catalogBaseline(air).venueId ||
  catalogBaseline(bay).flagLocation === catalogBaseline(air).flagLocation
)
  throw Error("Shared venue or separate flags lost.");
if (catalogBaseline(mobile).venue)
  throw Error("Mobile AO acquired a permanent venue.");
mkdirSync("qa/ao-hosted", { recursive: true });
writeFileSync(
  "qa/ao-hosted/verification.json",
  JSON.stringify(
    {
      ref,
      results,
      authenticated:
        tokens.length === 2
          ? "verified"
          : "pending synthetic isolated-user token",
      nestedRelations: "verified",
      planningChecks: "verified",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    ref,
    roles: tokens.map((t) => t.role),
    tables: Object.keys(expected.counts).length,
    nestedRelations: "verified",
    authenticated: tokens.length === 2 ? "verified" : "pending",
  }),
);
if (tokens.length !== 2) process.exitCode = 2;
