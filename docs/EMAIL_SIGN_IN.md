# Optional email-code sign-in

F3QBuilder uses one-time codes sent by email. Guest access stays open. Entering a code signs in to a personal workout library; there is no password and no SMS service.

## If your email sender is already configured

Keep the existing sender, DNS and SMTP settings. The only required configuration change for this switch is the two email templates in Supabase. Updating these repository files does not install them in Supabase automatically.

1. Open the project's **Authentication → Email → Templates** page (older dashboards call this **Email Templates**).
2. Under **Magic link**, use subject **Your F3QBuilder sign-in code** and replace the body with the complete contents of `docs/email-signin.html`. Save. Supabase keeps the “Magic link” template name even when its email contains a code.
3. Under **Confirm sign up**, use the same subject and replace the body with `docs/email-confirm-signup.html`. Save. Supabase can use this template for a first-time code request.
4. Both bodies must contain `{{ .Token }}`. That inserts the one-time code. The new templates have no sign-in button or hardcoded site URL.
5. On [staging](https://studio-ux-streamline--fe-workout-planner.netlify.app/), choose **Sign in**, enter your email, and choose **Email me a sign-in code**. Enter the emailed code back in the app and choose **Verify & sign in**. You can read the email on a different device or in another browser; enter the code on the app page you want to sign into.

Both templates retain the red wordmark header, charcoal background, readable light text and gold accent. The code is large, selectable text with no external image or font downloads. Set SMTP **Sender name** to **F3QBuilder** if it is not already set.

Real delivery and inbox rendering still require a real mailbox check. The automated checks use a simulated email service and send no messages. A sender configuration reported as complete by the account owner has not been independently verified by the connector.

## How long sign-in lasts

The app stores sessions between visits and automatically refreshes access tokens. Closing and reopening a regular browser does not intentionally sign someone out. There is no fixed logout timer in the app.

Supabase defaults to sessions with no fixed expiry. Signing out, clearing browser storage, revoked sessions, private browsing cleanup or server-configured session lifetime/inactivity rules can require another code. Short-lived access tokens renew automatically; their expiry is separate from the lifetime of the login and the expiry of an unused email code. This change does not modify Supabase's server session policies, which the connector cannot inspect or edit.

The code's own expiry and length are controlled by the Supabase Email provider settings. The app accepts numeric codes from 6 through 10 digits, supports one-time-code autofill and pasted spaces, and leaves validation to Supabase. No code is saved in browser storage, placed in a URL or logged by the app. Requests and verification attempts respect server limits; the UI includes a 60-second resend cooldown and a wait after verification rate-limit errors.

## Sender setup, only if needed

If an SMTP sender is already working, skip this section. Resend is a supported option with a free plan; these steps do not require a paid upgrade.

1. Create an account at [Resend](https://resend.com/). Choose its Free plan.
2. Under **Domains**, add `auth.f3thefe.com` and add the DNS records Resend provides where you manage `f3thefe.com`. Wait for **Verified**.
3. Create a sending API key for that verified domain. Keep it private and paste it directly into Supabase.
4. Open [Supabase SMTP Settings](https://supabase.com/dashboard/project/kitqovhdwzkhpxlepvfn/auth/smtp), or **Authentication → Email → SMTP Settings**, and enable custom SMTP:

   | Field | Value |
   | --- | --- |
   | Sender email | `signin@auth.f3thefe.com` |
   | Sender name | `F3QBuilder` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | Your private Resend API key |

   Save the settings. Never put SMTP credentials in frontend environment variables or source.
5. Keep the Email provider enabled and email confirmation required. Install both code templates above. Do not disable confirmation to work around delivery failures.

Supabase's default email sender is restricted to project-team addresses and is not suitable for public sign-in. See [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend's setup guide](https://resend.com/docs/send-with-supabase-smtp) and [Resend pricing](https://resend.com/pricing). No email-provider account, sender credentials, DNS records or paid subscription was created automatically.

## Staging and production

Typing a code completes sign-in on the app page where it is entered, without following an email return link. Staging and production retain separate browser sessions and device caches. Accounts and cloud workout records intentionally share the same pre-launch Supabase project.

The same-origin redirect option and old link handling remain compatible with previously delivered email links. Keep the existing URL configuration: allow `https://studio-ux-streamline--fe-workout-planner.netlify.app/**` for staging. Before the production login release, allow `https://q.f3thefe.com/?signin=1#my-workouts` and set **Site URL** to `https://q.f3thefe.com` as the default fallback. A temporary staging Site URL is valid during staging-only testing. Normal code sign-in does not require switching the Site URL between environments.

## Account storage and preservation

- Supabase JS 2.118.0 is pinned with a lockfile. New sign-ins use `signInWithOtp` to send the email and `verifyOtp({ email, token, type: 'email' })` to verify the code. The requested address remains fixed during verification; the UI supports correcting it before requesting another code.
- The browser uses only the public publishable key plus the user's current access token. Account requests never send a client-selected owner ID or guest recovery code.
- `fe_private.fe_account_vault` and the authenticated-only `fe_account_plans` RPC enforce `auth.uid()` ownership. Direct table access is revoked and RLS is enabled. The full workout validator, size limits and optimistic versions remain intact.
- Existing guest vaults and recovery codes are unchanged. Account libraries cannot be accessed through the guest capability RPC.
- Accounts have separate device workout caches, merge baselines, builder sessions, Markdown drafts and timer state. Signing out restores the guest workspace. Offline account caches remain readable on that browser; expired sessions never cause account uploads to fall back to guest storage.
- **Add guest workouts to my account** copies existing guest plans explicitly, preserving originals. Identical records are skipped and conflicting IDs become imported copies.
- Dirty editor changes and storage recovery warnings defer identity switches. Late requests are aborted or ignored when the workspace changes. Background token refresh for the same account preserves the open editor. Successful code verification opens My Workouts.

## Verification and release

The additive account database script is `docs/account-plan-sync.sql`, already applied to the existing authorized shared pre-launch project. No database change is needed for the email-code switch.

Database checks cover owner isolation, guest denial, malformed payloads and stale writes; live transaction-only tests left no synthetic users or records behind. Supabase's security advisor returned no findings when account storage was installed.

Code-flow browser fixtures exercise requests, wrong/expired codes, correction and successful verification, reload persistence, explicit guest import, a second browser opening the same account, sign-out restoring guest state and switching to a separate account. Older expired-link callbacks still recover safely. These checks do not establish actual SMTP delivery.

Staging only. No production website deployment or main merge is authorized. Before production, finish real email delivery verification, confirm templates and redirect settings, and follow the existing tested release process.

References: [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless), [sessions](https://supabase.com/docs/guides/auth/sessions), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
