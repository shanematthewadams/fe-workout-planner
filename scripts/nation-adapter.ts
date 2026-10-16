import { z } from "zod";
const instance = z.object({
  id: z.number().int().positive(),
  name: z.string().nullish(),
  isPrivate: z.boolean(),
  isActive: z.boolean(),
  startDate: z.string().nullish(),
});
const pageSchema = z.object({
  eventInstances: z.array(instance),
  totalCount: z.number().int().nonnegative(),
});
const detailSchema = instance.extend({
  backblast: z.string().nullish(),
  org: z
    .object({
      id: z.number(),
      name: z.string(),
      parentId: z.number().nullable(),
    })
    .nullable(),
});
export type NationDetail = z.infer<typeof detailSchema>;
/** Server/admin only. Original implementation; upstream code is a contract reference. */
export async function fetchNation({
  token,
  regionId,
  startDate,
  endDate,
  fetcher = fetch,
}: {
  token: string;
  regionId: number;
  startDate: string;
  endDate: string;
  fetcher?: typeof fetch;
}): Promise<NationDetail[]> {
  if (!token || !Number.isSafeInteger(regionId) || regionId <= 0)
    throw Error("Configure F3_NATION_TOKEN and F3_REGION_ID server-side.");
  if (
    ![startDate, endDate].every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)) ||
    startDate > endDate
  )
    throw Error("Choose an inclusive date window.");
  const get = async (path: string) => {
    const response = await fetcher(`https://api.f3nation.com/v1/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        client: "fe-workout-planner",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    // Never log credentials, response bodies, or raw backblasts.
    if (!response.ok)
      throw Error(
        `F3 Nation read failed (${response.status}); no catalog was changed.`,
      );
    return response.json();
  };
  const records: NationDetail[] = [],
    seen = new Set<number>();
  const pageSize = 100;
  let expectedTotal: number | undefined;
  for (let pageIndex = 0; pageIndex < 1000; pageIndex++) {
    const params = new URLSearchParams({
      regionOrgId: String(regionId),
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      startDate,
      startDateTo: endDate,
    });
    const page = pageSchema.parse(await get(`event-instance?${params}`));
    if (expectedTotal !== undefined && expectedTotal !== page.totalCount)
      throw Error("Source changed during pagination; retry the window.");
    expectedTotal = page.totalCount;
    if (page.eventInstances.length > pageSize)
      throw Error("Upstream ignored pagination; import stopped.");
    let added = 0;
    for (const event of page.eventInstances) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      added++;
      if (event.isPrivate || !event.isActive) continue;
      const response = await get(`event-instance/id/${event.id}`);
      // Current byId handler returns an instance object (inspect live before enabling).
      const detail = detailSchema.parse(response);
      if (detail.id !== event.id || detail.org?.parentId !== regionId)
        throw Error("Unexpected event/region in detail response.");
      if (!detail.isPrivate && detail.isActive && detail.backblast?.trim())
        records.push(detail);
    }
    if ((pageIndex + 1) * pageSize >= page.totalCount) {
      if (seen.size !== page.totalCount)
        throw Error("Incomplete or repeated upstream page; import stopped.");
      return records;
    }
    if (!added || page.eventInstances.length < pageSize)
      throw Error("Incomplete or repeated upstream page; import stopped.");
  }
  throw Error("Import page safety limit reached; use a narrower date window.");
}
