import { Parser } from "htmlparser2";
import { createHash } from "node:crypto";
import { z } from "zod";
import { indexCodex, CODEX_URL } from "./codex-intake.ts";
export const decisionSchema = z
  .object({
    source_id: z.literal("f3-nation-codex-reference-v1"),
    source_url: z.literal(CODEX_URL),
    decision_id: z.string().min(1),
    decided_by: z.string().min(1),
    decided_at: z.string().datetime({ offset: true }),
    basis: z.literal("product-owner-interpretation"),
    upstream_permission: z.literal("unresolved"),
    rationale: z.string().min(40),
    attribution: z.literal("F3 Nation · F3 Codex"),
  })
  .strict();
/** Convert source HTML to plain text once, at intake. No source HTML is ever rendered. */
export function codexPlainText(html: string) {
  const excluded = new Set([
    "script",
    "style",
    "iframe",
    "object",
    "svg",
    "math",
    "template",
    "noscript",
  ]);
  const blocks = new Set([
    "p",
    "div",
    "br",
    "li",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "table",
    "tr",
    "blockquote",
  ]);
  let hidden = 0;
  const parts: string[] = [];
  const parser = new Parser(
    {
      onopentag(name) {
        if (excluded.has(name)) hidden++;
        if (!hidden && blocks.has(name)) parts.push("\n");
      },
      ontext(value) {
        if (!hidden) parts.push(value);
      },
      onclosetag(name) {
        if (excluded.has(name)) hidden--;
        if (!hidden && name !== "br" && blocks.has(name)) parts.push("\n");
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return parts
    .join("")
    .replace(/\r/g, "")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function prepareCodexReference(
  raw: unknown,
  decisionInput: unknown,
  capturedAt = new Date().toISOString(),
) {
  const decision = decisionSchema.parse(decisionInput);
  z.string().datetime({ offset: true }).parse(capturedAt);
  // Reuse the full-feed validation/fingerprint logic; never interpret resolvedMentionsData as entries.
  const indexed = indexCodex(raw, undefined, {}, new Date(capturedAt));
  const rows = raw as {
    id: string;
    name: string;
    description: string;
    aliases?: { name: string }[];
    tags?: { id: string; name: string }[];
    mentionedEntries?: string[];
  }[];
  const fingerprints = new Map(
    indexed.index.entries.map((e) => [e.id, e.fingerprint]),
  );
  const tags = new Map<string, string>();
  const entries = rows
    .map((e) => {
      const description = codexPlainText(e.description);
      const name = codexPlainText(e.name);
      if (!name || !description) throw Error("Empty usable text: " + e.id);
      const aliasNames = [
        ...new Set((e.aliases ?? []).map((a) => codexPlainText(a.name))),
      ].sort();
      if (aliasNames.some((a) => !a))
        throw Error("Empty usable alias: " + e.id);
      for (const t of e.tags ?? []) {
        const name = codexPlainText(t.name);
        if (!name || (tags.has(t.id) && tags.get(t.id) !== name))
          throw Error("Conflicting tag identity: " + t.id);
        tags.set(t.id, name);
      }
      return {
        id: e.id,
        name,
        description,
        fingerprint: fingerprints.get(e.id)!,
        captured_at: capturedAt,
        aliases: aliasNames,
        tag_ids: [...new Set((e.tags ?? []).map((t) => t.id))].sort(),
        mentioned_ids: [...new Set(e.mentionedEntries ?? [])].sort(),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set(entries.map((e) => e.id));
  const duplicates = new Map<string, string[]>();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    duplicates.set(key, [...(duplicates.get(key) ?? []), e.id]);
  }
  return {
    decision,
    entries,
    tags: [...tags]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    report: {
      count: entries.length,
      aliases: entries.reduce((n, e) => n + e.aliases.length, 0),
      tags: tags.size,
      tagLinks: entries.reduce((n, e) => n + e.tag_ids.length, 0),
      mentions: entries.reduce((n, e) => n + e.mentioned_ids.length, 0),
      duplicateNames: [...duplicates]
        .filter(([, ids]) => ids.length > 1)
        .map(([name, ids]) => ({ name, ids })),
      missingMentions: entries.flatMap((e) =>
        e.mentioned_ids
          .filter((id) => !ids.has(id))
          .map((id) => ({ entry_id: e.id, target_id: id })),
      ),
      sourceFingerprint: createHash("sha256")
        .update(JSON.stringify(indexed.index.entries))
        .digest("hex"),
      upstreamPermission: "unresolved",
      reuseBasis: decision.basis,
      automaticPlanningClassification: false,
    },
    index: indexed.index,
  };
}
export type PreparedCodex = ReturnType<typeof prepareCodexReference>;
const q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
/** Operator-only transaction. No automatic connection, publication permission inference or canonical rewrites. */
export function codexReferenceSQL(data: PreparedCodex) {
  const d = decisionSchema.parse(data.decision),
    source = q(d.source_id),
    stamp = q(data.entries[0]?.captured_at ?? "");
  if (
    !data.entries.length ||
    data.entries.some((e) => e.captured_at !== data.entries[0].captured_at)
  )
    throw Error("A complete atomic capture is required");
  const json = q(JSON.stringify({ entries: data.entries, tags: data.tags }));
  return `begin;
set local lock_timeout='5s'; set local statement_timeout='30s';
insert into public.ao_sources(id,kind,url,captured_at,description) values(${source},'nation',${q(d.source_url)},${stamp},'Official Codex reference; product-owner reuse decision, upstream terms unresolved') on conflict(id) do nothing;
insert into public.ex_codex_reuse(source_id,decision_id,decided_by,decided_at,basis,upstream_permission,rationale,enabled)
values(${source},${q(d.decision_id)},${q(d.decided_by)},${q(d.decided_at)},${q(d.basis)},'unresolved',${q(d.rationale)},true) on conflict(source_id) do nothing;
do $$ begin
perform 1 from public.ex_codex_reuse where source_id=${source} for update;
if not exists(select 1 from public.ex_codex_reuse where source_id=${source} and decision_id=${q(d.decision_id)} and enabled and (last_capture_at is null or last_capture_at<=${stamp}::timestamptz)) then raise exception 'Existing operator decision retained; import refused'; end if;
end $$;
create temporary table codex_payload(data jsonb) on commit drop;
insert into codex_payload values(${json}::jsonb);
create temporary table codex_incoming on commit drop as select x.* from codex_payload,jsonb_to_recordset(data->'entries') as x(id text,name text,description text,fingerprint text,captured_at timestamptz,aliases jsonb,tag_ids jsonb,mentioned_ids jsonb);
alter table codex_incoming add primary key(id);
do $$ begin
if (select count(*) from codex_incoming) < (select count(*)*0.9 from public.ex_codex_entries where source_id=${source} and present) then raise exception 'Suspiciously incomplete feed; no changes applied'; end if;
if exists(select 1 from public.ex_codex_tags t join (select x.* from codex_payload,jsonb_to_recordset(data->'tags') as x(id text,name text)) i using(id) where t.name<>i.name) then raise exception 'Conflicting tag identity; review required'; end if;
end $$;
-- Capture conflicts before mutation; operators get a durable reconciliation result.
create temporary table codex_conflicts on commit drop as
select c.id, 'protected, older or conflicting source retained'::text reason from public.ex_codex_entries c join codex_incoming i using(id)
where c.source_id<>${source} or (c.fingerprint<>i.fingerprint and (c.protected or c.captured_at>=i.captured_at)) or (not c.present and (c.protected or c.captured_at>=i.captured_at));
insert into public.ex_codex_tags(id,name) select x.* from codex_payload,jsonb_to_recordset(data->'tags') as x(id text,name text) on conflict(id) do nothing;
-- Only accepted changed entries replace their own upstream associations. Local canonical rows are untouched.
create temporary table codex_changed on commit drop as select i.* from codex_incoming i left join public.ex_codex_entries c using(id)
where not exists(select 1 from codex_conflicts f where f.id=i.id) and (c.id is null or c.fingerprint<>i.fingerprint or not c.present);
insert into public.ex_codex_entries(id,name,description,fingerprint,captured_at,source_id,present)
select id,name,description,fingerprint,captured_at,${source},true from codex_changed
on conflict(id) do update set name=excluded.name,description=excluded.description,fingerprint=excluded.fingerprint,captured_at=excluded.captured_at,present=true;
delete from public.ex_codex_aliases a using codex_changed c where a.entry_id=c.id;
delete from public.ex_codex_entry_tags t using codex_changed c where t.entry_id=c.id;
delete from public.ex_codex_mentions m using codex_changed c where m.entry_id=c.id;
insert into public.ex_codex_aliases(entry_id,alias) select c.id,x.value from codex_changed c,jsonb_array_elements_text(c.aliases) x;
insert into public.ex_codex_entry_tags(entry_id,tag_id) select c.id,x.value from codex_changed c,jsonb_array_elements_text(c.tag_ids) x;
insert into public.ex_codex_mentions(entry_id,target_id) select c.id,x.value from codex_changed c,jsonb_array_elements_text(c.mentioned_ids) x;
-- Retain disappeared source records for reconciliation; hide them from public reads.
insert into codex_conflicts select c.id,'missing upstream; protected/newer record retained' from public.ex_codex_entries c where c.source_id=${source} and c.present and not exists(select 1 from codex_incoming i where i.id=c.id) and (c.protected or c.captured_at>=${stamp}::timestamptz);
create temporary table codex_removed on commit drop as select c.id from public.ex_codex_entries c where c.source_id=${source} and c.present and not c.protected and c.captured_at<${stamp}::timestamptz and not exists(select 1 from codex_incoming i where i.id=c.id);
update public.ex_codex_entries c set present=false,captured_at=${stamp}::timestamptz from codex_removed r where c.id=r.id;
update public.ex_codex_reuse set last_capture_at=${stamp}::timestamptz where source_id=${source} and (last_capture_at is null or last_capture_at<${stamp}::timestamptz);
select jsonb_build_object('incoming',(select count(*) from codex_incoming),'changed',(select count(*) from codex_changed),'removed',(select count(*) from codex_removed),'conflicts',coalesce((select jsonb_agg(f) from codex_conflicts f),'[]'::jsonb)) as reconciliation;
commit;`;
}
