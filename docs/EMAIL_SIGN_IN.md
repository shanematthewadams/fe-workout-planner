# Optional email sign-in

Guest access stays open. Sign-in is only needed to use a personal account library on another device. The app sends a one-use email link through the existing Supabase project (`kitqovhdwzkhpxlepvfn`); no password, SMS service, new project or paid AI provider is involved.

## Shane’s setup: a free sender option

If you already have a transactional email sender, use its SMTP credentials in the generic setup below. Otherwise, Resend is a supported option with a free plan. These steps do not require a paid upgrade.

1. Create an account at [Resend](https://resend.com/). Choose its Free plan; no paid plan is needed for this setup.
2. Open **Domains**, add `auth.f3thefe.com`, and add the DNS records Resend provides at the service where you manage `f3thefe.com`. This uses a separate sending subdomain. When Resend shows **Verified**, continue.
3. In Resend, open **API Keys** and create a sending key for that verified domain. Keep it private. You will paste it directly into Supabase, not into this chat or the app’s public settings.
4. Open [Supabase SMTP Settings](https://supabase.com/dashboard/project/kitqovhdwzkhpxlepvfn/auth/smtp) and enable custom SMTP. If the direct link moves, use **Authentication → Email → SMTP Settings**. Enter:

   | Field | Value |
   | --- | --- |
   | Sender email | `signin@auth.f3thefe.com` |
   | Sender name | `F3QBuilder` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | Your private Resend API key |

   Save the settings.
5. Open [Supabase URL Configuration](https://supabase.com/dashboard/project/kitqovhdwzkhpxlepvfn/auth/url-configuration). Under **Redirect URLs**, add `https://studio-ux-streamline--fe-workout-planner.netlify.app/**` and save. This lets a staging sign-in return to staging.
6. Open [staging](https://studio-ux-streamline--fe-workout-planner.netlify.app/), choose **Sign in**, enter your own email, and open the emailed link in the same browser. This confirms real inbox delivery; the automated checks below already cover the app behavior.

Sources checked October 19, 2026: [Resend’s Supabase setup guide](https://resend.com/docs/send-with-supabase-smtp), [Resend pricing](https://resend.com/pricing). No Resend account, sender credentials, DNS records or paid subscription was created automatically.

## Branded authentication emails

The repository now includes two branded email bodies. They are prepared for installation; a Git push does not install them in Supabase.

1. Open the project's **Authentication → Email → Templates** page (older dashboards call this **Email Templates**).
2. For **Magic link**, set the subject to **Your F3QBuilder sign-in link**. Replace the body with the complete contents of `docs/email-signin.html` and save.
3. For **Confirm sign up**, set the subject to **Finish signing in to F3QBuilder**. Replace the body with `docs/email-confirm-signup.html` and save. Supabase can use this message for a first-time email-link sign-in.
4. Set the SMTP **Sender name** to **F3QBuilder**, as shown above. Both templates use a red wordmark header, charcoal background, readable light text and a red button with a gold accent. They have no external images or font downloads.
5. Keep the button's `{{ .ConfirmationURL }}` exactly as supplied. It includes Supabase verification and the requested return URL. Do not replace it with a hardcoded staging URL, production URL or `{{ .SiteURL }}`. Turn off your email provider's link tracking so it does not rewrite the sign-in link.
6. After installing, verify a first-time sign-in and a returning sign-in with a real mailbox. Prepared HTML alone does not prove inbox rendering or delivery. Template changes apply to this shared Supabase project, so staging and production use the same branding.

## Staging and production returns

The app derives each sign-in return URL from the browser's current origin. A staging request returns to staging; a production request returns to production once that build is approved and released. Browser sessions and account caches are separate between the sites; accounts and cloud workout records intentionally use the same pre-launch Supabase project.

Both return destinations must be allowed in Supabase. The staging wildcard in the setup above covers staging. Before the production login release, allow the exact production return URL `https://q.f3thefe.com/?signin=1#my-workouts` and set **Site URL** to `https://q.f3thefe.com` as the default fallback. A temporary staging Site URL is valid during staging-only testing. We do not need separate Supabase projects or to keep switching the Site URL between sites during normal use.

## What is implemented

- Sign in / My account in the red app navigation; the account form lives above Saving & recovery.
- Supabase JS 2.118.0, pinned with a lockfile. PKCE links bind the exchange to the browser that requested the link. The email screen explains that the link must open in the same browser. Sessions persist and refresh through Supabase.
- Public publishable key only in the browser. Account requests carry the current session token; they never send a client-selected owner ID or guest capability.
- Separate `fe_private.fe_account_vault` and authenticated-only `fe_account_plans` RPC. The private helper checks `auth.uid()` and scopes every read/write to that verified owner. Direct browser access is revoked; RLS is also enabled. The existing full personal-workout validator, size limit and optimistic versions are retained.
- The existing guest vault and recovery code flow remain unchanged. No account can inherit a guest vault merely by knowing its user ID.
- An account gets a separate local workout cache, merge baseline, builder session, Markdown draft and timer state. Sign-out restores the guest workspace. Offline account caches remain available on that browser, including when a stored session needs refreshing. Account uploads never fall back into guest storage.
- Existing guest workouts can be copied into the account with **Add guest workouts to my account**. Original guest copies are preserved. Identical records are skipped; conflicting IDs become imported copies.
- Dirty editor changes and storage recovery warnings defer identity switches; account saving pauses when the current credentials no longer match the open workspace. Late requests are aborted/ignored when the workspace changes.
- Link errors and rate limits have readable messages. Resending has a 60-second cooldown. Callback parameters are removed after session handling. Automated browser checks use a fake auth server and send no real emails.

## External setup before public email testing

The connector can manage this project's database but does not expose its Auth configuration or an email provider account. The app code cannot configure SMTP credentials or DNS safely. No SMTP settings, providers, templates, billing settings, or production deployments were changed.

1. Open [Supabase URL Configuration](https://supabase.com/dashboard/project/kitqovhdwzkhpxlepvfn/auth/url-configuration).
2. Add `https://studio-ux-streamline--fe-workout-planner.netlify.app/**` to **Redirect URLs** and save. Keep the existing Site URL unless you deliberately want to change the default return destination. The app explicitly requests the current origin, so staging sign-ins return to staging. There is no external user-supplied return URL.
3. Open [Supabase SMTP Settings](https://supabase.com/dashboard/project/kitqovhdwzkhpxlepvfn/auth/smtp). Connect or verify a transactional email sender using its host, port, username/password and verified From address. Keep these credentials in Supabase, never in the app's frontend environment variables or source.
4. Keep the Email provider enabled and email confirmation required. The standard Magic Link template using `{{ .ConfirmationURL }}` works; no SMS provider or phone authentication is needed. Do not disable confirmation to work around email delivery failures.
5. Once the sender is ready, open [staging](https://studio-ux-streamline--fe-workout-planner.netlify.app/), choose **Sign in**, enter your own email and open the link in the same browser. This last delivery check requires a real mailbox; automated tests cannot prove inbox delivery.

Supabase's default email sender is restricted to project-team addresses and is not suitable for public sign-in. See [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Database deployment and verification

`docs/account-plan-sync.sql` is an additive script applied to the existing, explicitly authorized shared pre-launch project. It does not alter guest data. Rerunning this create script is unnecessary; check existing objects before applying.

The local PGlite tests verify authentication, account isolation, RLS and stale-write rejection. Live transaction-only checks create two synthetic identities, test ownership/validation/conflicts and guest denial, then roll back. No test identities or account records remain. Supabase's security advisor returned no findings after installation.

Release verification: **308 unit/integration tests and 68 browser checks passed**; four historical comparison checks were intentionally skipped because no before-build was supplied. Lint, typecheck and the staging build passed. Desktop and mobile account screenshots were reviewed.

Browser fixtures verify PKCE email requests and exchanges, repeat-request throttling, initial account loading, explicit guest import, a second browser retrieving the account, sign-out returning to guest state, account switching and failed-link recovery. These are simulated auth checks; they do not establish actual SMTP delivery.

## Release

Staging only. Main and production remain unchanged pending Shane's explicit approval. Before a production release, add the production origin to allowed Redirect URLs if it is not already present, verify the sender and real mailbox delivery, and follow the existing tested release process. Browser caches are separate between staging and production; the same authenticated Supabase account uses the same account vault.
