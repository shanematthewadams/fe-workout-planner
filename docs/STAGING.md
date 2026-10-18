# Staging and production

Shane approved the first staging deployment on October 18, 2026. This does not authorize a production release.

- `main` remains production at `https://q.f3thefe.com`.
- `studio/ux-streamline` is the sole active development and staging branch.
- Netlify branch deploys and deploy previews set `VITE_APP_ENV=staging`; production explicitly sets `production`.
- Staging shows a visible label. Browser saves and backups work, while CloudSync does not mount its active controls or legacy Studio cloud import. The cloud request helper rejects staging calls before sending a network request.
- Published regional catalog access remains read-only. This is an app safeguard, not a separate database or a new database access policy.
- GitHub Checks runs on staging branch pushes and can also run manually. It builds the staging app and exercises the existing desktop/tablet/mobile Chromium and mobile WebKit journeys plus staging protections. These checks use a local server in CI, not the protected Netlify URL; live Netlify runtime verification is separate.
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
