/** Read-only diagnostic. Never return credentials, source text, attendance, or contact data. */
export async function probeNation(env, fetcher = fetch) {
  if (
    env.NETLIFY !== "true" ||
    env.CONTEXT !== "branch-deploy" ||
    env.BRANCH !== "develop"
  )
    return { status: "skipped", reason: "development-build-only" };
  const token = env.F3_NATION_TOKEN?.trim(),
    region = Number(env.F3_REGION_ID);
  if (!token || !Number.isSafeInteger(region) || region <= 0)
    return { status: "not-configured" };
  const read = async (path) => {
    const response = await fetcher("https://api.f3nation.com/v1/" + path, {
      headers: {
        Authorization: `Bearer ${token}`,
        Client: "fe-workout-planner",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) return { httpStatus: response.status };
    return { httpStatus: response.status, data: await response.json() };
  };
  try {
    const end = new Date().toISOString().slice(0, 10),
      start = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
    const list = await read(
      "event-instance?" +
        new URLSearchParams({
          regionOrgId: String(region),
          pageIndex: "0",
          pageSize: "100",
          startDate: start,
          startDateTo: end,
        }),
    );
    if (list.httpStatus !== 200)
      return { status: "request-rejected", httpStatus: list.httpStatus };
    const rows = list.data?.eventInstances;
    if (!Array.isArray(rows) || !Number.isInteger(list.data?.totalCount))
      return { status: "unexpected-list-schema" };
    const sample = rows
      .filter(
        (r) =>
          Number.isSafeInteger(r.id) &&
          r.isPrivate === false &&
          r.isActive === true,
      )
      .slice(-3);
    const result = {
      status: "ok",
      totalEvents: list.data.totalCount,
      sampledPublicEvents: sample.length,
      detailReads: 0,
      plaintextNarratives: 0,
      richNarratives: 0,
      recognizedWorkoutSections: 0,
      detailFailures: [],
    };
    for (const row of sample) {
      const detail = await read(`event-instance/id/${row.id}`);
      if (detail.httpStatus !== 200) {
        result.detailFailures.push(detail.httpStatus);
        continue;
      }
      const d = detail.data;
      // Fail closed if privacy, identity or regional ownership differs in the detail response.
      if (
        d?.id !== row.id ||
        d.isPrivate !== false ||
        d.isActive !== true ||
        d.org?.parentId !== region
      ) {
        result.detailFailures.push("schema-or-region");
        continue;
      }
      result.detailReads++;
      if (typeof d.backblast === "string" && d.backblast.trim()) {
        result.plaintextNarratives++;
        if (
          /(?:^|\n)\s*[*#_ ]*(?:the thang|thang|warm.?a.?rama|warm.?up|mary)\b/im.test(
            d.backblast,
          )
        )
          result.recognizedWorkoutSections++;
      }
      if (Array.isArray(d.backblastRich) && d.backblastRich.length)
        result.richNarratives++;
    }
    return result;
  } catch {
    return { status: "unavailable" };
  }
}
