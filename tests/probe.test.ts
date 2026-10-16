import { it, expect, vi } from "vitest";
import { probeNation } from "../scripts/nation-probe.mjs";
const env = {
  NETLIFY: "true",
  CONTEXT: "branch-deploy",
  BRANCH: "develop",
  F3_NATION_TOKEN: "synthetic-secret-token",
  F3_REGION_ID: "1",
};
it("never reads source credentials from production, CI or another branch", async () => {
  const f = vi.fn();
  for (const patch of [
    { CONTEXT: "production" },
    { BRANCH: "main" },
    { NETLIFY: "false" },
  ])
    expect(await probeNation({ ...env, ...patch }, f)).toMatchObject({
      status: "skipped",
    });
  expect(f).not.toHaveBeenCalled();
});
it("returns status codes without echoing credential errors", async () => {
  const f = vi.fn(
    async () => new Response("sensitive provider body", { status: 401 }),
  );
  expect(await probeNation(env, f)).toEqual({
    status: "request-rejected",
    httpStatus: 401,
  });
});
it("reports narrative availability without exposing source text or private records", async () => {
  const event = { id: 1, isPrivate: false, isActive: true };
  const f = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        totalCount: 2,
        eventInstances: [event, { ...event, id: 2, isPrivate: true }],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        ...event,
        org: { parentId: 1 },
        backblast: "The Thang\n10 merkins\nCOT\nprivate health information",
        backblastRich: [{ private: "raw narrative" }],
      }),
    );
  const report = await probeNation(env, f);
  expect(report).toMatchObject({
    status: "ok",
    sampledPublicEvents: 1,
    detailReads: 1,
    plaintextNarratives: 1,
    richNarratives: 1,
    recognizedWorkoutSections: 1,
  });
  expect(f).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(report)).not.toMatch(
    /synthetic-secret|health information|raw narrative/,
  );
});
it("treats timeout or malformed responses as unavailable rather than leaking exceptions", async () => {
  const f = vi.fn().mockRejectedValue(new Error("secret detail"));
  expect(await probeNation(env, f)).toEqual({ status: "unavailable" });
});
