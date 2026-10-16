import { afterEach, describe, it, expect, vi } from "vitest";
import { SupabaseCatalog, BundledCatalog } from "../src/repository";
import { catalog } from "../src/catalog";
import { copyWorkout } from "../src/model";
afterEach(() => vi.restoreAllMocks());
describe("catalog repositories", () => {
  it("keeps bundled sources isolated", async () => {
    const list = await new BundledCatalog().list();
    list[0].title = "change";
    expect(catalog[0].title).not.toBe("change");
  });
  it("reads only published rows with a public key and validates them", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([{ data: catalog[0] }])));
    expect(
      await new SupabaseCatalog(
        "https://example.supabase.co",
        "public-key",
      ).list(),
    ).toEqual([catalog[0]]);
    expect(fetcher.mock.calls[0][0].toString()).toContain("published=eq.true");
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ apikey: "public-key" });
  });
  it("rejects personal records, malformed data, duplicate IDs, HTTP failures and insecure URLs", async () => {
    const reader = new SupabaseCatalog(
      "https://example.supabase.co",
      "public-key",
    );
    const f = vi.spyOn(globalThis, "fetch");
    for (const data of [
      [{ data: copyWorkout(catalog[0]) }],
      [{ data: {} }],
      [{ data: catalog[0] }, { data: catalog[0] }],
    ]) {
      f.mockResolvedValueOnce(new Response(JSON.stringify(data)));
      await expect(reader.list()).rejects.toThrow();
    }
    f.mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(reader.list()).rejects.toThrow();
    await expect(
      new SupabaseCatalog("http://example.com", "public-key").list(),
    ).rejects.toThrow();
  });
});
