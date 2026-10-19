# F3 Nation directory hookup — October 19, 2026

The updated server-side key successfully authenticated from Netlify. The existing region ID `48088` is correct: Nation identifies it as The Fe. No credential values were printed, committed, included in public responses, or bundled into the frontend.

## Connection correction

The Netlify settings connector returns partially masked secret values. Earlier local HTTP 401 responses made with that masked representation did not establish that the saved real key was invalid. A health-check HTTP 200 also did not establish authenticated access. The valid connection evidence is the server-side directory import, including authenticated location-detail reads.

The general `/v1/org-chart` response contained 557 non-null organizations, only 15 of type AO, and no matching FE AO entries. It was unsuitable for this regional directory import even though the configured region appeared correctly. The collector now uses the official parent-filtered `/v1/org` endpoint with `orgTypes=ao`, `parentOrgIds=48088`, active status and explicit pagination. It validates every returned parent and activity flag, rejects duplicate/truncated/changing pages, and fetches referenced default locations in bounded batches.

## Reviewed data

- Netlify returned **21 active regional AO records and 17 validated default locations**.
- All **16 existing app AOs** have unique normalized-name matches to Nation IDs.
- Only those 16 reviewed links are stored in `data/ao-nation.json`. Nation-only records, including administrative/fellowship groups and Blackops, were not added to the app’s schedule.
- AO identities, schedules, local venue facts, closures, amenities and guest/account data remain intact.
- South Park’s listed default is Brougham Elementary School. Its marina guidance remains separate; no default map pin overrides a Q’s seasonal venue choice.
- Stagecoach and The Gathering retain distinct Nation location IDs/pins at the same broader community-center venue. Neither is described as a field-verified exact flag position.
- The AO Directory links to the official map with its documented `locationId`, `lat`, `lng` and `zoom` parameters. It labels the listed default location and reminds users to confirm the current meeting point.

## Runtime and privacy

`/api/nation-directory` runs only on branch deploys, uses server-held settings, ignores caller-supplied URLs/region IDs, accepts GET only, applies a domain request limit and an overall import deadline, and returns validated AO/location fields. Contact details, leadership records, user IDs, emails and credentials are excluded. Production returns 404 if the function is later deployed there without an explicit change.

The app uses the reviewed snapshot, so opening the AO Directory does not require a new Nation request. Map links open Nation’s own current map. Future imports are review candidates; no scheduled refresh, automatic overwrite of local facts or new public workout publishing was introduced.

## Verification

Local verification: **351 tests passed across 45 files**, including HTTP contracts, pagination failures, wrong-region rejection, sensitive-field stripping, fixed-region server behavior, all 16 identity matches, separate shared-venue pins and seasonal-map labeling. Lint, TypeScript and the production build passed. CI also passed **351 tests across 45 files**, lint, TypeScript and build: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39324472660. Browser verification passed **72 checks**, with 4 optional historical comparisons skipped, across desktop, tablet, mobile Chromium and mobile WebKit. The AO journey verifies South Park’s explicit Brougham default/seasonal warning and Heartland’s official location ID, with screenshots and existing accessibility/overflow checks. Reviewed the mobile WebKit screenshot: the map link and default/seasonal labels are readable, with no horizontal overflow.

Released source: `ad75e61c6c88ee5822559466efcde9db71681d4e`, tested tree `c5373a92b57b2ae776c5eea6f037dc763b88a4fa`.

Hosted staging serves `/assets/index-VZoNmKBu.js`, matching the staging-configured local build byte-for-byte (SHA-256 `37c5ba95b91f10e5e0057ca6699e3b3b5bf1a14a2321854d93b3c54dbeaab364`). The deployed bundle includes the map links and no Nation server credential markers. The authenticated server read returned 21/17 records as above. No production merge, production frontend publish or database change was made.
