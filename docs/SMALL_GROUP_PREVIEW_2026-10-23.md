# F3 Q Builder: small-group preview guide

Target preview: Friday, October 23, 2026. Staging only: https://studio-ux-streamline--fe-workout-planner.netlify.app/

This guide follows the interface checked during the reliability sprint. The latest reliability changes are not on staging until engineering records a matching deployment in `RELIABILITY_SPRINT_VERIFICATION.md`.

## First workout (no account required)

1. Open staging and choose **Build**. Describe your workout idea, for example: "I have a Q at Gold Rush, want coupons, and want a digging-for-gold theme."
2. Optionally open **Workout details** and choose the workout type (**Bootcamp**, **Run**, or **Ruck**), length, AO, equipment and other preferences. Confirm today's site conditions yourself. Unknown AO features are not promises of availability.
3. Choose **Build my workout**, or choose **Use offline template** if the AI service is unavailable. Review the actual exercises, counts, timing and conditions before leading. AI output is a draft, not a safety inspection.
4. Choose **Edit the details**, make changes, then **Save & view workout**. To keep the draft as shown, choose **Save a private copy**. **Saved to cloud** confirms cloud backup; **Saved on this device** means the browser copy is safe but upload is pending or unavailable.
5. Open **My Workouts** to find the saved workout, reopen it, and choose **Lead workout**. Lead opens a readable sheet; starting a timer is optional. Use **Session timer** for the workout timeline or **Intervals** for a circuit.

## Optional account and return visit

An account is optional for planning. For a profile and private account storage, select **Keep my workouts**, then **Create account**; enter your **F3 Name** and email. The signup message uses an **email confirmation link**. Returning users use the separate **email sign-in code** flow. These are not interchangeable.

When opening a saved-workout bookmark, the app waits for library recovery and opens it when available. If you started as a guest, follow the guest-workout import option rather than rebuilding your workout. To check recovery choices, use **Saving & recovery**. Never send private recovery codes as shared workout URLs.

Session countdowns and intervals pause when you leave Lead mode; use **Resume** when you return. **Join live … schedule** follows the clock even after leaving. Sound is optional. If screen wake is declined, keep the screen awake manually. A failed AI refinement leaves the previous draft intact; retry later or deliberately choose a template.

## Before the Q

Confirm the AO and any seasonal venue selection, weather, surface condition, equipment, route and shelter with local leadership. A map link identifies an official default location, not a verified landmark, safe route or facility. Save and open the workout before heading outdoors; verify any offline copy while connected.

## Known limits for preview participants

- AO amenities, Site Q names and Nation locations are **reviewed snapshots**, not automatic live synchronization. Some information remains unknown or pending Site Q review.
- AI availability and quality depend on the free eligible providers; a template fallback is different from generated output.
- Cloud acknowledgement is distinct from a device save. Offline copies remain device-dependent until successfully synchronized.
- Browser emulation covers phone layouts and timer behavior, but physical-device background audio, locked-screen timing, voice output and wake-lock operation have **not** been verified on a real iPhone.
- Shared/public workout publishing and a public AO editing system are not part of this preview.

## Engineer release gate

This guide can be shared after engineering verifies the current staging deployment matches the tested branch. Record the commit/tree, CI results, browser screenshots/accessibility, hosted bundle comparison, and any remaining defects in a separate release report. Do not treat this guide as a substitute for that verification.
