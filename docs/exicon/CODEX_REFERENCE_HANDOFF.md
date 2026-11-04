# Codex reference import and staging browser · November 4, 2026

## Outcome and scope

Shane instructed engineering to proceed after emailing Roma and following up twice in Nation Slack. `data/codex-reuse-decision.json` records his product-owner interpretation, attribution, rationale and date. **No affirmative upstream permission or license is asserted.** This decision supersedes the prior development prerequisite in `READ_PATH_HANDOFF.md`; upstream terms remain unresolved. Do not ask again solely because an older handoff says permission is pending.

This bounded milestone imports the official source reference corpus and exposes it in the existing staging app's **Exicon & Lexicon → Nation Exicon** tab. It preserves the current 50-movement planning guide and eight database-backed planner exercises. Source tags, similar names and phrases such as “variation” do not automatically establish movement mechanics, counting conventions, equipment, facility requirements or canonical identity. Official entries include routines and combinations; all 977 are references, not 977 independently classified planner exercises. Generation/format selection is not expanded in this milestone. No new AI calls, provider changes, workout rewrites, account changes, production app deployment or main merge are included.

## Verified starting point and environment

Re-cloned after workspace maintenance; remote `studio/ux-streamline` was `00c75ae3b4c1bba39382d30d25d64ba345ceed88` and main was `e254c11ec266e62586208cb1282f9eeb8e7b093a`. Existing branch choice and standing shared-database/staging authorization override the older develop-mirror/approval instructions in AGENTS.md. One repository/one staging branch retained.

Approved existing shared Supabase project: `kitqovhdwzkhpxlepvfn`. Reinspected all public RLS flags, Exicon policies and seven recorded migrations before changes. Supabase changelog checked November 4: CLI v3 defaults/confirmations changed; migration generation deliberately used pinned CLI **2.81.3**, not an unreviewed upgrade. Current RLS documentation checked. No existing schema definitions or grants were changed.

## Schema, source lineage and rollback

Local migration `supabase/migrations/20261104153007_codex_reference_catalog.sql`; applied remotely as **`20261104153712 codex_reference_catalog`**. Preserve the existing local/remote migration mappings; do not run blind db push/reset/repair.

Six additive normalized tables:

- `ex_codex_reuse`: operator decision, its explicit unresolved upstream status, enable/disable switch and last successful capture watermark. This does not populate or fabricate an `ex_source_licenses` grant.
- `ex_codex_entries`: official stable IDs, sanitized plain descriptions, fingerprints, capture/source provenance, presence and protection flags.
- `ex_codex_aliases`: alias rows tied to exact official parent IDs.
- `ex_codex_tags`: official tag identities/names.
- `ex_codex_entry_tags`: normalized tag associations.
- `ex_codex_mentions`: exact upstream mention targets. Only the source end has a foreign key because some upstream targets are absent or Lexicon records.

One provenance row is added to existing `ao_sources`, ID `f3-nation-codex-reference-v1`. Official IDs remain separate even if names collide. No changes to existing canonical IDs, aliases, counting, formats or planner requirements.

`public.fe_codex_reference()` is SQL/STABLE/SECURITY INVOKER with empty search_path. Explicit anonymous/authenticated/operator execution; no PUBLIC execution grant. All six tables enable RLS, public roles keep SELECT only and operator writes use service_role/database owner. Parent presence and enabled source decision control every descendant read. Disabling the source hides entries, aliases, tags, links and mentions. No user-editable profile authorization or browser service-role key is used.

Disable reads with privileged `update public.ex_codex_reuse set enabled=false where source_id='f3-nation-codex-reference-v1';`. Cached public snapshots expire within sixty seconds on a subsequent read. Open browser views refresh on focus; already downloaded text cannot be recalled. The legacy guide remains available. Re-import cannot re-enable a disabled decision. Full schema rollback: `supabase/rollback/codex_reference_catalog.sql`, locally tested against the complete live capture. It drops only this corpus/function, explicitly removes the dependent tag read policy and uses no CASCADE; the single provenance row may remain. Existing exercise, workout, profile and private vault tables are outside rollback scope. Application rollback: redeploy the prior tested staging app `9d11ba42211b6dbc0be172f876707847d7905494`.

## Source intake, counts and reconciliation

One controlled source read of `https://codex.f3nation.com/api/exicon`; source capture was 697,544 bytes. All entries passed existing whole-feed identity/type/shape validation. Raw nested `resolvedMentionsData`, contributor contact data and HTML markup are not imported. `htmlparser2` **10.0.0** is pinned in package/lockfile to parse HTML; script/style/iframe/object/SVG/math/template content is excluded, entities decoded and paragraphs/lists retained as text. React text rendering is used throughout; there is no dangerouslySetInnerHTML, source URL rendering or AI interpretation in this path. The original link is generated from a fixed HTTPS Codex origin and encoded official ID.

Actual imported rows:

| Table | Rows |
| --- | ---: |
| Entries | 977 |
| Aliases | 131 |
| Tags | 26 |
| Tag links | 2,172 |
| Mentions | 44 |
| Reuse decisions | 1 |

Source fingerprint: `b6cb2d51f43665b039339a8a42c887cda5a3a59c51f555205b083180399e0918`. All 977 official IDs match the durable prior metadata baseline. No duplicate names or conflicting tag IDs were found. Five mentioned targets are unresolved: one missing Exicon ID (`exicon-1753308824847-mosey`) and four Lexicon IDs. Exact IDs and parent links are in `docs/exicon/codex-reference-verification.json`; they remain references without invented records or guessed replacements.

`catalog:codex-prepare` validates an entire capture before producing ignored `qa/codex/reference.sql`, report and raw capture cache. It performs one bounded fixed-origin read only when the 24-hour cache is absent/expired or `--refresh` is explicit. It never connects to Supabase. Snapshot preparation and the SQL import are separate operator operations. No cron/automatic upstream polling is installed. Source prose is kept in the authorized DB and ignored temporary import cache, not bundled into browser assets or committed as a second corpus.

The import transaction uses fixed tables, escaped strings, bounded lock/statement timeouts, source-decision row serialization, monotonic capture checks, duplicate identities, conflicting tag identities and a >10% drop guard. Existing source decisions are insert-only. Identical entries make no content writes; changed source entries update only when newer and unprotected, replacing only their own upstream associations. Protected/older/conflicting identities are retained with reconciliation output. Missing records are retained as hidden tombstones, never deleted automatically. No name-based canonical merge, deletion of local requirements or auto-publication into the planner occurs. A source content change does not invalidate an unrelated local canonical decision.

The initial live transaction reported **977 changed / 0 removed / 0 conflicts**. The complete original capture was imported twice into local Postgres with **0 changed / 0 removed / 0 conflicts on repeat**. Two live repeat attempts returned the connector's “confirmation expired” response; no live repeat success is claimed. One used the original source SQL and another reconstructed the fully parity-checked persisted snapshot through the same SQL import logic. Do not bypass the connector to manufacture repeat evidence. Local complete-capture and fixture idempotence evidence is retained, and live source parity/grants are independently verified.

## Read path, caching and app behavior

`server/codex-reference.ts` adds a bounded cached database RPC reader and shared GET handler. Netlify `/api/codex` and the Vite preview use that handler. App read timeout two seconds, response bound 3 MB, max 5,000 entries, sixty-second success cache, four connection identities and concurrent request coalescing. Failed/invalid reads do not replace a successful cache entry or count as success. Production/deploy-preview database gating follows the existing `exiconEnvironment`; only approved branch deploy/dev context can opt in. App API requests never call Nation or AI.

The staged reference tab loads on demand, coalesces browser requests, caches for sixty seconds and refreshes on focus. Search covers name, alias, tag and description locally; tag filtering and incremental display (40 entries) keep the browser manageable. Each entry credits F3 Nation and links to its exact original. Outage/malformed responses show a clear fallback message and leave the app's bundled Exicon tab available. Source classifications remain descriptive tags, never a claim of bodyweight/no-running suitability. The tab is staged behind existing `isStaging()`; production application promotion and enabling production database-backed reads still require deliberate release approval/review.

## Verification and compatibility

- Local full suite initially **474 tests / 63 files** passed; one subsequent preview-route test adds explicit no-AI quota/GET parity. Final total and CI evidence are below.
- Targeted tests exercise sanitizer injection/entity/structure handling, duplicate/tag/source conflicts, unresolved mentions, wrong decision basis, source protection/older snapshots/removals/drop guard, revoked source behavior, duplicate-name identity, both SQL roles, every write privilege, invoker RPC, rollback compatibility, server and browser coalescing/failure/cache behavior, search/attribution, and source HTML rendered as inert text.
- `catalog:codex-local` verifies every description, alias, tag link, mention and fingerprint against the **actual complete 977-entry capture** under both anon/authenticated Postgres roles, repeat no-op and full rollback.
- `AO_CATALOG_ALLOW_SHARED=true npm run catalog:codex-hosted` verifies every real public database record and relationship against that capture, all official IDs against the durable baseline, search and **18 real anonymous REST write denials** (POST/PATCH/DELETE × six tables). An initial empty PATCH probe returned a no-op rather than exercising permissions; the corrected verifier sends a non-empty synthetic field update and requires 401/403 plus SQLSTATE 42501. No synthetic row was created.
- Live authenticated SQL role reads return 977 entries / 131 aliases / 26 tags, with no INSERT/UPDATE/DELETE/TRUNCATE grants. No real user JWT/session was borrowed, so authenticated HTTP transport remains outside this milestone.
- SQL EXPLAIN ANALYZE owner snapshot: approximately 44.6 ms. The operator runtime uses an explicit 15-second network diagnostic budget; this is distinct from the two-second deployed reader budget.
- Before/after live row counts **and checksums match** for workouts (36), beatdowns (0), profiles (1), guest plan vault (27), account vault (0) and canonical exercises (8). No private row contents or credentials are in the report. The prior private logical backup remains historical, not an independent disaster-recovery/auth backup; additive schema rollback avoids restoring user data.
- Security advisors are unchanged: seven intentional private-backup no-policy INFO findings, plus existing disabled leaked-password protection WARN. No new reference-table findings. See [RLS advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Local browser installation was unavailable (APT sandbox privilege failure; browser CDN downloads were truncated). Fresh CI browser and real hosted UI verification are required before calling staging verified. No test failure is reclassified as a pass.

## Exact next milestone and release boundary

Build a reviewed **official-ID → existing canonical movement/format** mapping for the planning vocabulary. Compare mechanics explicitly; preserve regional aliases/counting and local requirements; keep unknown requirements out of automatic eligibility. Start with the existing 50 movements and two formats, and use fingerprint-bound reviews so changes cannot silently overwrite verified local mechanics. This reference corpus provides source material and source links; it does not remove that engineering/semantic review step. Provider JSON reliability remains a separate known limitation from the preceding sprint; no live AI success is claimed here.

Before any production app release, verify the current main/branch identities, fresh normal suites and actual deployed catalog/UI, review activation of production reads, then obtain Shane's explicit approval. Never infer production deployment approval from the shared database or Exicon reuse decisions.

## Deployment evidence

Pending fresh staging push/CI/hosted verification. This section is updated after the tested implementation is deployed; do not treat the earlier sprint's 132 browser checks as verification of this change.
