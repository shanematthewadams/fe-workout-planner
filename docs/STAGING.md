# Staging and production

Shane approved the first staging deployment on October 18, 2026. This does not authorize a production release.

- `main` remains production at `https://q.f3thefe.com`.
- `develop` is the canonical development branch. `studio/ux-streamline` is the existing Netlify staging deployment mirror; fast-forward it to tested develop commits.
- Netlify branch deploys and deploy previews set `VITE_APP_ENV=staging`; production explicitly sets `production`.
- Staging shows a visible label and uses the existing Supabase private workout store, as Shane authorized on October 18, 2026. No separate database, schema or paid resource is required. Each private connection code still scopes its own collection. Cloud saving is automatic for saved workouts, with a local offline queue. Staging keeps its browser recovery identity separate; using that code elsewhere is optional and only needed to open the same private workouts on another device or URL. Legacy Studio import remains disabled on staging. Browser saves and backups remain available if the connection drops.
- Published regional catalog access remains read-only. This is an app safeguard, not a separate database or a new database access policy.
- GitHub Checks runs on staging branch pushes and can also run manually. It builds the staging app and exercises the existing desktop/tablet/mobile Chromium and mobile WebKit journeys plus staging protections. These checks first use a local server in CI. Staging-mirror pushes then verify the deployed commit and the hosted desktop/WebKit journey with synthetic storage and blocked cloud writes, followed by an explicit real-provider evaluation. Provider failures are reported separately from template success.
- Netlify provides the branch URL. Preserve existing team-login protection. Do not create a second project or another working branch.
- A merge into `main`, production database change, or production publish still requires Shane's explicit approval.

## Tester walkthrough

1. Open the staging link provided after a successful deploy. Sign into Netlify if asked.
2. Check the staging label at the top.
3. Open Library, try the quick filters, and choose Use this workout.
4. Edit the personal copy, try Add from movement guide, and set reps or time.
5. Save and reopen from My Workouts. The production library original is unchanged.
6. Try a workout request in Build; any template fallback should be labeled.

Plans saved on a staging URL do not automatically appear on the production URL. Export a backup if test work is worth keeping.
