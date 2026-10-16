// Engineering-only checks. Uses a public key; never needs service_role credentials.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (
  url !== "https://kitqovhdwzkhpxlepvfn.supabase.co" ||
  !key?.startsWith("sb_publishable_")
)
  throw Error("Configure the dedicated FE URL and publishable key");
const base = url + "/rest/v1/workouts",
  headers = { apikey: key, "Content-Type": "application/json" };
const request = (path = "", options = {}) =>
  fetch(base + path, {
    headers,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    ...options,
  });
const response = await request("?select=id,data&order=id.asc");
assert.equal(response.status, 200);
const rows = await response.json(),
  regional = JSON.parse(
    await readFile(
      new URL("../data/regional-workouts.json", import.meta.url),
      "utf8",
    ),
  );
assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
assert.equal(
  rows.filter((r) => r.data.provenance.status === "illustrative").length,
  10,
);
assert.equal(rows.length, regional.length + 10);
for (const w of regional)
  assert.deepEqual(rows.find((r) => r.id === w.id)?.data, w);
const fixture = "fe-verification-unpublished-20261016";
const hidden = await request("?select=id&id=eq." + fixture);
assert.equal(hidden.status, 200);
assert.deepEqual(await hidden.json(), []);
const writes = [];
for (const method of ["POST", "PATCH", "DELETE"]) {
  // All probes target the same reserved, unpublished engineering fixture, never a real card.
  const path = method === "POST" ? "" : "?id=eq." + fixture;
  const body =
    method === "DELETE"
      ? undefined
      : JSON.stringify(
          method === "POST"
            ? {
                id: fixture,
                data: { ...rows[0].data, id: fixture },
                approved: false,
                published: false,
              }
            : { published: false },
        );
  const r = await request(path, { method, body }),
    payload = await r.json();
  assert.ok([401, 403].includes(r.status));
  assert.equal(payload.code, "42501");
  writes.push({ method, status: r.status, code: payload.code });
}
console.log(
  JSON.stringify({
    published: rows.length,
    regionalExactParity: regional.length,
    unpublishedHidden: true,
    writes,
  }),
);
