import { createHash } from "node:crypto";
import { z } from "zod";
import { boundedText } from "../server/exicon-intelligence.ts";
export const CODEX_URL = "https://codex.f3nation.com/api/exicon";
const id = z.string().min(1).max(512);
const entrySchema = z.object({
  id,
  name: z.string().min(1).max(500),
  type: z.literal("exicon"),
  description: z.string().max(100000),
  aliases: z
    .array(z.object({ name: z.string().min(1).max(500) }))
    .max(100)
    .default([]),
  tags: z
    .array(z.object({ id, name: z.string().min(1).max(200) }))
    .max(100)
    .default([]),
  videoLink: z.string().nullable().optional(),
  mentionedEntries: z.array(id).max(500).default([]),
});
export const codexIndexSchema = z
  .object({
    version: z.literal(1),
    source: z.literal(CODEX_URL),
    permission: z.literal("unresolved"),
    checkedAt: z.string().datetime({ offset: true }),
    entries: z
      .array(
        z
          .object({
            id,
            fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
            present: z.boolean(),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict();
export type CodexIndex = z.infer<typeof codexIndexSchema>;
export type ReviewDecision = {
  fingerprint: string;
  state: "pending" | "approved" | "rejected";
};
export const decisionsSchema = z.record(
  z
    .object({
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      state: z.enum(["pending", "approved", "rejected"]),
    })
    .strict(),
);
export function indexCodex(
  raw: unknown,
  previous?: CodexIndex,
  decisions: Record<string, ReviewDecision> = {},
  now = new Date(),
  allowLargeRemoval = false,
) {
  const entries = z.array(entrySchema).min(1).max(5000).parse(raw);
  const found = new Map<string, string>();
  for (const e of entries) {
    // Only the entry's own content participates. Nested resolved mentions can be huge,
    // and their descriptions are neither persisted nor imported through this tool.
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          id: e.id,
          name: e.name,
          description: e.description.trim(),
          aliases: e.aliases.map((a) => a.name).sort(),
          tags: e.tags.map((t) => t.name).sort(),
          videoLink: e.videoLink ?? null,
          mentionedEntries: [...e.mentionedEntries].sort(),
        }),
      )
      .digest("hex");
    if (found.has(e.id))
      throw Error(
        "Duplicate upstream identity; source must be reconciled before advancing the baseline",
      );
    found.set(e.id, fingerprint);
  }
  const prior = previous ? codexIndexSchema.parse(previous) : undefined;
  if (
    prior &&
    new Set(prior.entries.map((e) => e.id)).size !== prior.entries.length
  )
    throw Error("Duplicate baseline identity");
  const old = new Map(prior?.entries.map((e) => [e.id, e]) ?? []);
  const active = prior?.entries.filter((e) => e.present).length ?? 0;
  if (!allowLargeRemoval && active && found.size < active * 0.9)
    throw Error(
      "Suspiciously incomplete feed; prior index retained. Review before allowing a large removal.",
    );
  const changes: {
    id: string;
    kind: "new" | "changed" | "removed" | "restored";
    previousFingerprint?: string;
    fingerprint: string;
  }[] = [];
  const indexed = [...found].map(([id, fingerprint]) => {
    const before = old.get(id);
    const kind = !before
      ? "new"
      : !before.present
        ? "restored"
        : before.fingerprint !== fingerprint
          ? "changed"
          : undefined;
    if (kind)
      changes.push({
        id,
        kind,
        previousFingerprint: before?.fingerprint,
        fingerprint,
      });
    return { id, fingerprint, present: true };
  });
  for (const before of old.values())
    if (!found.has(before.id)) {
      indexed.push({ ...before, present: false });
      if (before.present)
        changes.push({
          id: before.id,
          kind: "removed",
          previousFingerprint: before.fingerprint,
          fingerprint: before.fingerprint,
        });
    }
  const index: CodexIndex = {
    version: 1,
    source: CODEX_URL,
    permission: "unresolved",
    checkedAt: now.toISOString(),
    entries: indexed.sort((a, b) => a.id.localeCompare(b.id)),
  };
  const nextDecisions = Object.fromEntries(
    index.entries.map((e) => {
      const saved = decisions[e.id];
      return [
        e.id,
        {
          fingerprint: e.fingerprint,
          state:
            e.present &&
            old.get(e.id)?.present &&
            saved?.fingerprint === e.fingerprint
              ? saved.state
              : "pending",
        },
      ];
    }),
  );
  return {
    index,
    decisions: nextDecisions,
    report: {
      checkedAt: index.checkedAt,
      source: CODEX_URL,
      count: found.size,
      changes,
      publication: "blocked-unresolved-permission",
      descriptionsPersisted: false,
      sqlGenerated: false,
      automaticDeletions: false,
    },
  };
}
export async function collectCodex(
  previous?: CodexIndex,
  decisions: Record<string, ReviewDecision> = {},
  options: {
    refresh?: boolean;
    allowLargeRemoval?: boolean;
    now?: Date;
    fetcher?: typeof fetch;
  } = {},
) {
  if (previous) {
    previous = codexIndexSchema.parse(previous);
    if (
      new Set(previous.entries.map((e) => e.id)).size !==
      previous.entries.length
    )
      throw Error("Duplicate baseline identity");
  }
  const now = options.now ?? new Date();
  if (
    previous &&
    !options.refresh &&
    now.getTime() - Date.parse(previous.checkedAt) >= 0 &&
    now.getTime() - Date.parse(previous.checkedAt) < 86400000
  ) {
    return {
      cached: true,
      index: previous,
      decisions: Object.fromEntries(
        previous.entries.map((e) => [
          e.id,
          {
            fingerprint: e.fingerprint,
            state:
              e.present && decisions[e.id]?.fingerprint === e.fingerprint
                ? decisions[e.id].state
                : "pending",
          },
        ]),
      ),
      report: {
        checkedAt: previous.checkedAt,
        source: CODEX_URL,
        count: previous.entries.filter((e) => e.present).length,
        changes: [],
        publication: "blocked-unresolved-permission",
        descriptionsPersisted: false,
        sqlGenerated: false,
        automaticDeletions: false,
      },
    };
  }
  const response = await (options.fetcher ?? fetch)(CODEX_URL, {
    headers: {
      "User-Agent": "F3-Q-Builder/1.0 (read-only Codex source review)",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw Error("Codex read failed: " + response.status);
  const raw = JSON.parse(await boundedText(response, 20_000_000));
  return {
    cached: false,
    ...indexCodex(raw, previous, decisions, now, options.allowLargeRemoval),
  };
}
