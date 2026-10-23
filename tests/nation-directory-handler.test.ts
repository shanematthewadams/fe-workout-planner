import { expect, it, vi } from "vitest";
import { handleNationDirectory } from "../server/nation-directory-handler";
const env = {
  token: "private-fixture-token",
  regionId: "5",
  deployContext: "branch-deploy",
};
const request = () =>
  new Request(
    "https://staging.invalid/api/nation-directory?regionId=999&url=https://untrusted.invalid",
  );
it("uses only the saved region and strips contact and leadership details from Nation responses", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 1,
          orgs: [
            {
              id: 100,
              parentId: 5,
              isActive: true,
              defaultLocationId: 6,
              name: "South Park",
              orgType: "ao",
              email: "private@example.test",
              positions: [{ userId: 42 }],
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          location: {
            id: 6,
            locationName: "Public park",
            regionId: 5,
            isActive: true,
            latitude: 38,
            longitude: -94,
            addressStreet: null,
            addressCity: null,
            addressState: null,
            email: "private@example.test",
          },
        }),
      ),
    );
  const result = await handleNationDirectory(request(), env, fetcher);
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body.regionId).toBe(5);
  expect(body.orgs).toHaveLength(1);
  expect(body.candidates[0]).toMatchObject({
    localId: "fe-ao-south-park",
    status: "needs-review",
  });
  expect(body.locations[0].id).toBe(6);
  expect(JSON.stringify(body)).not.toMatch(
    /private|email|positions|userId|Other region/,
  );
  expect(
    new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization"),
  ).toBe("Bearer private-fixture-token");
  expect(
    fetcher.mock.calls.every(([url]) =>
      String(url).startsWith("https://api.f3nation.com/v1/"),
    ),
  ).toBe(true);
});
it("does not run in production, on writes, or with absent or masked settings", async () => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    (
      await handleNationDirectory(
        request(),
        { ...env, deployContext: "production" },
        fetcher,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await handleNationDirectory(
        new Request(request().url, { method: "POST" }),
        env,
        fetcher,
      )
    ).status,
  ).toBe(405);
  expect(
    (
      await handleNationDirectory(
        request(),
        { ...env, token: "****************1234" },
        fetcher,
      )
    ).status,
  ).toBe(503);
  expect(
    (await handleNationDirectory(request(), { ...env, token: "" }, fetcher))
      .status,
  ).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
it("reports upstream authorization failures without exposing tokens or upstream response bodies", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response("private-fixture-token private@example.test", {
      status: 401,
    }),
  );
  const response = await handleNationDirectory(request(), env, fetcher);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({
    status: "unavailable",
    reason: "nation-authorization",
    upstreamStatus: 401,
    failureType: "Error",
  });
});
it("rejects malformed directory results and timeouts without returning a partial import", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("{}"));
  expect((await handleNationDirectory(request(), env, fetcher)).status).toBe(
    502,
  );
  fetcher.mockRejectedValueOnce(new DOMException("fixture", "TimeoutError"));
  expect((await handleNationDirectory(request(), env, fetcher)).status).toBe(
    502,
  );
});
it("does not invent AOs when the region has no active records", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ orgs: [], total: 0 })));
  const response = await handleNationDirectory(request(), env, fetcher);
  expect(await response.json()).toMatchObject({
    reason: "nation-directory",
    detail: "no-regional-aos",
  });
});
