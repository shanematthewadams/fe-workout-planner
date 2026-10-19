# Site Q roster correction — October 19, 2026

## Root cause

The AO Directory badge read only `fe_ao_site_qs` from device storage. Some reviewed amenities had been imported from the inventory, but the explicit Site Q roster column was not wired into the directory. Removing earlier unsupported hardcoded defaults did not justify ignoring the now-available source roster.

Read the current **F3 AO Amenities Inventory** with the connected Google Drive/Sheets tools. Verified native spreadsheet identity, visible tab `AO Directory` (`sheetId=201`), headers at row 4, and bounded range `A4:D21`. The roster comes only from the `Site Q(s)` column. An amenity-review status of Pending does not invalidate an explicit roster name. Reporter names and current-user profile names are not used as fallback Site Q identities.

Source: https://docs.google.com/spreadsheets/d/1bc2SK_VebCAZQTn4r54XV4AcFKtDwr1Dqwb8UxP1Tmw/edit#gid=201

## Changes

- Imported names for all 16 existing AOs into `data/ao-site-qs.json`, including co-Qs. Duplicate South Park venue rows agree and are merged, retaining their source row references.
- Badges use the inventory roster by default. Existing device overrides remain labeled local/unverified; clearing an override restores the roster. Resetting defaults also restores the roster.
- Added an inventory source link and refresh date. Missing source names remain unknown; names are never inferred from an amenity report author.
- Added `catalog:sync-site-qs` and a testable importer. It validates exact headers and normalized AO identities, preserves co-Qs, rejects conflicting venue rosters and refuses partial or wholly empty roster replacement. It does not create or rename AOs.
- The sheet itself was not edited. No Google credentials were deployed, and no database/auth changes were made.

## Refresh model

This is a reviewed source snapshot bundled with the app, not automatic live Google Sheets synchronization. Engineering can refresh it by reading current metadata and bounded roster cells through the connected Sheets tool, saving the returned values array to an ignored working file, then running `npm run catalog:sync-site-qs -- <values.json>` and verifying the diff before release. Changes to the source sheet do not appear instantly in an already-deployed app.

## Verification

Local: **357 tests passed across 47 files**; lint, TypeScript and build passed. Coverage includes source-only identity selection, seasonal co-Q deduplication/conflict rejection, missing source names, complete current AO coverage, local override preservation and restoration of the regional roster. The existing AO browser journey now asserts South Park’s Duffalo/Jazz Hands badge before the map, venue, accessibility and overflow checks.

CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39326170605 — **357 tests across 47 files passed**, lint and build passed; **72 browser checks passed**, 4 optional historical comparisons skipped, across desktop, tablet, mobile Chromium and mobile WebKit.

Released source: `b8bb0654447f62e8fe7273fce07c9d630b7f6760`, verified tree `bbac5c9b85139b7dc0c8836c3e0aa72a84530e34`. Hosted staging serves `/assets/index-DdCeJblG.js`, matching the staging-configured local build byte-for-byte: SHA-256 `936bf07dd66369f814a9fa9d3301e71d90acfc95352074cde548abad0bf9ff0d`. Its bundle includes the imported co-Q names. No production merge or frontend publish was performed.

Reviewed the mobile WebKit screenshot: South Park displays `Site Qs: Duffalo, Jazz Hands`; the source link, refresh date and badge are readable without horizontal overflow.
