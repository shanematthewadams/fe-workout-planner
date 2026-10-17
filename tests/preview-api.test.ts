import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { plannerDevApi } from "../server/planner-dev.ts";
let server: ViteDevServer, base: string;
beforeEach(async () => {
  server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [plannerDevApi()],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string")
    throw Error("Missing preview server");
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await server.close();
});
function request(body: unknown, headers: Record<string, string> = {}) {
  return fetch(base + "/api/plan-workout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base, ...headers },
    body: JSON.stringify(body),
  });
}
const idea = {
  prompt: "Dora, no coupons and no running",
  ao: "Downrange",
  strictSchedule: true,
  startTime: "06:30",
  site: { amenities: { lighting: "lit", surface: "asphalt" } },
};
describe("Studio preview uses the production planner API", () => {
  it("returns a labeled valid template with the same timing, exclusions and site snapshot without keys", async () => {
    const response = await request(idea),
      result = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(result.provider).toBe("Template");
    expect(result.workout.equipment).toEqual([]);
    expect(result.workout.schedule.startTime).toBe("06:30");
    expect(result.workout.schedule.siteSummary).toContain("Lighting: Lit");
    expect(
      result.plan.sections
        .flatMap((s: { blocks: { minutes: number }[] }) => s.blocks)
        .reduce((n: number, b: { minutes: number }) => n + b.minutes, 0),
    ).toBe(43);
  });
  it("preserves origin checks and the shared body limit", async () => {
    expect(
      (await request(idea, { Origin: "https://other.example" })).status,
    ).toBe(403);
    expect((await request({ ...idea, prompt: "x".repeat(50000) })).status).toBe(
      413,
    );
    expect((await fetch(base + "/api/plan-workout")).status).toBe(405);
  });
  it("accepts the Studio proxy's matching HTTPS origin", async () => {
    const response = await request(idea, {
      Origin: "https://preview.run.app",
      "X-Forwarded-Host": "preview.run.app",
      "X-Forwarded-Proto": "https",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).provider).toBe("Template");
  });
  it("limits preview requests too", async () => {
    for (let i = 0; i < 5; i++) expect((await request(idea)).status).toBe(200);
    expect((await request(idea)).status).toBe(429);
  });
});
