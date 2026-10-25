# Exicon: implementation-ready next sprint proposal

Status: proposed, no migration applied and no official Exicon import authorized by this document.

Current implementation is `src/movements.ts`: stable local IDs, aliases, counting prose,
equipment, facility requirements, running flags and alternatives built over
`src/studio/reference.ts` EXICON_DATABASE. `server/planner-context.ts` selects up to
24 eligible movements using equipment, running and site availability. Existing
constraint checks and deterministic fallbacks depend on these conventions.
Retain those contracts and IDs; the catalog is an adapter, not a new exercise engine.

## Relational contract

All IDs below are text primary keys; all foreign keys indexed. Names alone are
never identity. `region_id` references `ao_regions(id)`. Reuse `ao_sources` for
provenance; retain licensing information in a dedicated source-license table.

| Table | Columns and constraints |
| --- | --- |
| `ex_source_licenses` | `source_id` PK/FK `ao_sources`, `license_name`, `permission_url`, `reviewed_at`, `redistribution_allowed` boolean NOT NULL DEFAULT false; all unknown permission stays false |
| `ex_exercises` | `id`, `name` NOT NULL, `instructions` NOT NULL, `movement_category` NOT NULL, `running` boolean NOT NULL, `alternative` text, `source_id` FK, `publication_status` CHECK draft/reviewed/published; published requires reviewed source permission |
| `ex_variations` | `id`, `exercise_id` FK, `region_id` nullable FK, `name`, `instructions`, `source_id` FK, `publication_status`; separate rows describe actual movement changes, never just alternative names |
| `ex_aliases` | `id`, `exercise_id` FK, `variation_id` nullable FK, `region_id` nullable FK, `alias`, `normalized_alias`, `source_id` FK; composite FK `(variation_id,exercise_id)` references UNIQUE `(id,exercise_id)` on variations so aliases cannot point at the wrong canonical movement |
| `ex_counting_conventions` | `id`, `exercise_id` FK, `variation_id` nullable FK, `region_id` nullable FK, `convention` CHECK 1=1/2=1/per-side/cadence/time/distance/not-applicable, `cycle_description` NOT NULL, `count_on` nullable smallint CHECK 1..4, `source_id` FK; composite variation/exercise FK as above |
| `ex_equipment_types` | `id`, `name` UNIQUE NOT NULL; seed only existing app equipment values initially |
| `ex_exercise_equipment` | composite PK `(exercise_id,equipment_id)`, both FKs, `required` boolean; variations get a separate similarly keyed variation-equipment table |
| `ex_exercise_facilities` | composite PK `(exercise_id,amenity_id)`, FKs exercises/`ao_amenity_types`; separate variation-facility table for changed requirements |
| `ex_formats` | `id`, `name`, `instructions`, `source_id`, `publication_status` |
| `ex_format_parameters` | composite PK `(format_id,parameter_key)`, FK formats, `value_type` CHECK integer/number/text/boolean, `required` boolean, nullable numeric `minimum`/`maximum`, CHECK minimum<=maximum |

Use two partial unique alias indexes: `(normalized_alias,exercise_id,coalesce(variation_id,''))`
WHERE region_id IS NULL, and `(region_id,normalized_alias,exercise_id,coalesce(variation_id,''))`
WHERE region_id IS NOT NULL. Allow the same alias to name multiple movements;
return ambiguity instead of silently selecting the first result. Require nonempty
IDs and normalized alias values so the empty-string index sentinel cannot collide.

Resolution order: explicit variation selection; reviewed regional counting/aliases;
reviewed canonical counting/aliases; current app fallback. A regional alias never
implicitly changes mechanics or counting. Counting must still describe a complete rep,
per-side treatment, and IC cycle. Unknown counting requires Q confirmation.

Keep flexible format configuration small and typed. For 11s require start/end totals,
exercise pair, traversal definition and stopping rule; for ladders require step,
ceiling, direction and stopping rule. Store measured distances only when supplied
with evidence; do not invent route lengths or cadence from an exercise name.

## Security and rollout

Enable RLS and public SELECT for published rows only. Drafts and permission reviews
remain operator-only; service_role/database operators write, with no profile-based
admin flag. Public reads require an explicitly published parent, variation and
source permission. Do not expose a privileged function or default-definer view.

First milestone: inventory and permission review, then additive schema plus a local
fixture import of the existing **app-authored conventions** whose reuse rights are
established. Do not treat bundled third-party descriptions as automatically licensed.
Add ambiguity/counting/variation/security tests before replacing the movement selector.
No bulk official Exicon import until redistribution permission is verified and recorded.

Before that milestone, finish hosted AO read validation in an authorized isolated
Supabase project if one is supplied. Keep generation on the tested JSON path until
facility equivalence, closure precedence, temporary Q overrides and route defaults
have passed the same constraint tests with database context.
