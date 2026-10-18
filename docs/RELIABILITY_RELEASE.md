# Reliability and focused planning release

This release addresses the October 17 deep audit in the existing app and development branch. Saved-workout schema version 1 and backups remain compatible.

## Changed behavior

- The initial screen leads with an idea field and build action. Setup and draft review are separate views; detailed movement help and review notes can be expanded as needed. The dedicated timer hides the global header, navigation, and footer.
- Formal title, Q name, focus, style, gear, PAX count, mode, and unfinished refinement recover with the session. Resolved equipment/running restrictions persist across refinements. Explicit revisions can remove equipment/running.
- Instructions containing known running or portable-gear requirements are checked against restrictions as well as metadata. This is a conservative text guard; it is not a complete semantic classifier of all F3 movements.
- A text closure survives conflicting availability statements. Unknown terrain remains excluded.
- Template outcomes explain the failure reason. A failed new generation or refinement preserves an existing draft. Logs record safe outcome/provider/rejection metadata without prompt text. Free routes reserve time for fallback and advance after invalid output.
- Timer phases derive from saved blocks and declared duration. Unknown/inconsistent timing requires an explicit standard-schedule choice. Clock, exercise position, workout revision, and local session date recover together. Reset also resets the exercise; a new date starts fresh.
- Offline installation separates core application assets from best-effort fonts and exposes a readiness indicator. Saved plans and explicit templates remain available offline after installation.
- Printing allows sections to flow and count phrases to wrap normally; site-detail controls are omitted.
- One consolidated stylesheet replaces the old base-plus-design override pair. Rendering/session recovery are extracted from the planner. An app error boundary offers a safe reopen path.

## Database validation

`npm run sync:schema` generates `docs/workout-sync.schema.json` from the app's Zod model and `docs/plan-sync-hardening.sql` for the dedicated FE database. A regression test checks that the generated files match the model.

The deployed `harden_plan_sync_payload_validation` migration enables pg_jsonschema and adds a private validation helper plus the `valid_workout_payload` constraint. It validates new/updated vault payloads, including nested shape, section kinds, and unique internal identifiers. The constraint is deliberately **NOT VALID**: preexisting rows were not scanned, replaced, or deleted. The existing code-scoped RPC and table permissions are unchanged. Read-only synthetic checks verified valid acceptance and malformed/duplicate-ID rejection; the security advisor returned no findings.

For a fresh project, apply `docs/plan-sync.sql` first, then the hardening SQL. For an existing project, apply the hardening once through a named migration. Regenerating SQL does not deploy it. A future schema change must update the database validator as well as the client and preserve old backups.

An unreadable cloud snapshot now stops sync before merging/writing and offers the raw snapshot as a recovery download. No existing invalid record is silently discarded. Workout backups cover saved plans/favorites; AO device notes retain their separate export.

## Verification

The local suite includes audit regression cases for false metadata, conflicting AO claims, builder recovery, consecutive refinements, prior-draft preservation, timer recovery/reset/new day, custom/unknown timing, consistent Mary doses, and malformed sync recovery. Separate provider tests verify fallback after timing violations. Database contract generation is checked in the suite.

Browser CI covers desktop Chromium, tablet Chromium, mobile Chromium, and mobile WebKit. Checks include initial build-action visibility, full create/refine/edit/save/print/lead flow, exercise recovery, offline reopening, setup recovery after navigation/reload, library/AO behavior, and automated accessibility checks. Fixtures test deterministic behavior; they do not establish live model quality.

## Follow-up boundaries

- Live free-provider quality, quotas, and physical iPhone audio/background/wake-lock behavior need separate evidence. WebKit automation is useful coverage but is not a real-device guarantee.
- Accountless sync-code rotation/revocation, legacy public Studio-record retention, full backup consolidation, URL/history routing, and deeper editor/App decomposition remain future work.
- The production team's existing sign-in protection is unchanged. No additional app, repository, branch, or Supabase project was created.
