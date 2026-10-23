import { expect, it, vi } from "vitest";
import { fetchNationDirectory } from "../scripts/nation-directory";
const org = (id: number, parentId = 5) => ({
  id,
  name: `AO ${id}`,
  orgType: "ao",
  parentId,
  defaultLocationId: null,
  isActive: true,
});
const page = (orgs: unknown[], total: number) =>
  new Response(JSON.stringify({ orgs, total }));
it("uses an explicit regional AO filter and reads every page before producing a directory", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(page([org(1)], 2))
    .mockResolvedValueOnce(page([org(2)], 2));
  const result = await fetchNationDirectory({
    token: "fixture",
    regionId: 5,
    fetcher,
  });
  expect(result.orgs.map((row) => row.orgId)).toEqual([1, 2]);
  expect(result.locationBasis).toBe("default");
  const first = new URL(String(fetcher.mock.calls[0][0]));
  expect(first.searchParams.get("parentOrgIds")).toBe("5");
  expect(first.searchParams.get("orgTypes")).toBe("ao");
  expect(
    new URL(String(fetcher.mock.calls[1][0])).searchParams.get("pageIndex"),
  ).toBe("1");
});
it("stops if the API ignores region filters or repeats a page", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(page([org(1, 999)], 1));
  await expect(
    fetchNationDirectory({ token: "fixture", regionId: 5, fetcher }),
  ).rejects.toThrow("mismatch");
  fetcher
    .mockResolvedValueOnce(page([org(1)], 2))
    .mockResolvedValueOnce(page([org(1)], 2));
  await expect(
    fetchNationDirectory({ token: "fixture", regionId: 5, fetcher }),
  ).rejects.toThrow("Duplicate");
});
it("does not accept a truncated or changing directory as a complete import", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(page([org(1)], 2))
    .mockResolvedValueOnce(page([], 2));
  await expect(
    fetchNationDirectory({ token: "fixture", regionId: 5, fetcher }),
  ).rejects.toThrow("Incomplete");
  fetcher
    .mockResolvedValueOnce(page([org(1)], 2))
    .mockResolvedValueOnce(page([org(2)], 3));
  await expect(
    fetchNationDirectory({ token: "fixture", regionId: 5, fetcher }),
  ).rejects.toThrow("changed");
});
