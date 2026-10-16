import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fetchNation } from "./nation-adapter.ts";
import { extractSections, sourceSchema } from "./catalog-import.ts";
const approved = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(
    new URL("../data/source-permissions.json", import.meta.url),
    "utf8",
  ),
);
async function main() {
  if (
    process.env.NETLIFY !== "true" ||
    process.env.CONTEXT !== "branch-deploy" ||
    process.env.BRANCH !== "develop"
  )
    return;
  if (approved.feBackblasts?.approved !== true)
    throw Error("Approval not recorded");
  const end = new Date().toISOString().slice(0, 10),
    start = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const rows = await fetchNation({
    token: process.env.F3_NATION_TOKEN ?? "",
    regionId: Number(process.env.F3_REGION_ID),
    startDate: start,
    endDate: end,
  });
  const candidates = [];
  let rejected = 0;
  const content = new Set();
  for (const r of rows) {
    const sections = extractSections(r.backblast ?? "");
    // Fail closed; private or unrelated text inside a workout section requires separate manual handling.
    const body = sections.map((s) => s.text).join("\n");
    const personal =
      /\b(prayer|prayers|praying|cancer|diagnos\w*|hospital\w*|surger\w*|chemotherap\w*|obituary|phone|email|announcements?|moleskin|cot)\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|<@[A-Z0-9]+>/i;
    if (
      !sections.some((s) => s.kind === "thang") ||
      personal.test(body) ||
      sections.length > 3 ||
      new Set(sections.map((s) => s.kind)).size !== sections.length
    ) {
      rejected++;
      continue;
    }
    const hash = createHash("sha256")
      .update(body.toLowerCase().replace(/\s+/g, " ").trim())
      .digest("hex");
    if (content.has(hash)) continue;
    content.add(hash);
    const source = sourceSchema.parse({
      sourceId: `f3nation:event:${r.id}`,
      url: `https://api.f3nation.com/v1/event-instance/id/${r.id}`,
      title:
        (r.name || r.org?.name || "Regional workout").slice(0, 130) +
        " · " +
        (r.startDate?.slice(0, 10) ?? "date unknown"),
      ao: r.org?.name,
      eventDate: r.startDate?.slice(0, 10),
      sections,
      reuse: { basis: "permission", evidence: approved.feBackblasts.evidence },
      issues: [
        "Q not resolved from source; no attendance inference",
        "Source API link may require F3 Nation access",
      ],
      privacyReviewed: false,
    });
    candidates.push(source);
  }
  const target = new URL(
    "../.netlify/blobs/deploy/fe-review/",
    import.meta.url,
  );
  await mkdir(target, { recursive: true });
  await writeFile(
    new URL("candidates.json", target),
    JSON.stringify(candidates, null, 2),
    { mode: 0o600 },
  );
  console.log(
    "FE_PRIVATE_REVIEW_EXPORT " +
      JSON.stringify({
        candidates: candidates.length,
        excluded: rejected,
        published: 0,
      }),
  );
}
main().catch(() => {
  console.error(
    "FE_PRIVATE_REVIEW_EXPORT unavailable; existing published catalog unchanged.",
  );
  process.exitCode = 1;
});
