# F3 Q Builder palette

Shane selected the steel-blue concept on October 22, 2026. This is a supporting-accent sweep of the existing Athletic Editorial / Modern Outdoor interface, not a new design or feature set.

| Role | Token | Color |
| --- | --- | --- |
| Page ground | `--charcoal`, `--ground` | `#1c1d1a` |
| Form/card surface | `--surface` | `#292b26` |
| Raised surface | `--surface-raised` | `#343730` |
| Main text | `--ink` | `#f8f5ed` |
| Secondary text | `--muted` | `#c1c2b8` |
| Neutral control border | `--line` | `#85877e` |
| Steel-blue structural accent | `--steel` | `#527d9c` |
| Steel-blue readable text/focus tint | `--steel-text` | `#8eafc6` |
| Steel-blue badge background | `--steel-soft` | `#263541` |
| Primary action/current step | `--gold` | `#ffaa00` |
| Brand navigation | existing navigation rail | `#bd142b` |

## Usage

- Red remains the brand navigation; gold remains primary Build/Save/Lead actions, the current planning step and active workout timing.
- Steel blue supports keyboard focus, focused inputs, secondary control hover, AO icons and available-feature summaries, informational links, library card edges/tags/selected filters, movement-guide expansion, import preview, and timer preparation/rest cues.
- Successful **Saved to cloud** text gets the readable blue tint. Pending, offline, recovery and error messages retain their existing wording and neutral/error styling. No cloud state is inferred from color.
- Unknown AO facts remain unknown. The concept's broad “Site Q verified” badge was not implemented: color does not promote unverified facts or invent verification.
- Focus indicators on the red rail remain white. Steel blue resolves to black in print; existing Q-sheet layout, gold timeline dividers and counting rules are preserved.

## Contrast

Calculated with WCAG relative luminance: the selected `#527d9c` is 3.85:1 on the ground and 3.25:1 on the input/card surface; it is suitable for supporting lines, not normal-size text. The readable `#8eafc6` tint is 7.34:1 on the ground, 6.20:1 on surfaces, 5.24:1 on raised surfaces, and 5.45:1 on the blue badge background. This tint also provides focus contrast. Labels and icons accompany state information.

Shared tokens and general UI rules live in `src/style.css`; library, movement, import and Lead-specific rules live in `src/library.css`. No new dependencies, data formats, provider calls, authentication or infrastructure changes are needed for this palette.

## October 22 verification

- Palette implementation commit: `19827fa011ed7534b14a3c0d1ecf9a9e3ebb72e9`; tree: `e870edda10825531de8fe7f51f6858ddfb79f802`. Final deployed/verified commit: `19d10a466e99a19bb11dd1f2228bceb4427d522c`; tree: `eb6d727efd38bf24013544d6d79910c974853912`. The latter changes only the CI installation timeout, not application code. Developed on `develop` and fast-forwarded to the existing `studio/ux-streamline` staging mirror. Production `main` remains `07ff6315a6c36f357eb8446e6fd30939948f773d` and was not promoted.
- Staging: https://studio-ux-streamline--fe-workout-planner.netlify.app/. `build-info.json` returned the exact final deployed commit and `staging` environment. Direct hosted UI inspection confirmed the warm input surface (`rgb(41, 43, 38)`), readable focus border (`rgb(142, 175, 198)`) and steel base token (`#527d9c`). Example fill, AO context and Library filtering worked on the deployed build.
- Local clean `npm ci`, 387 tests across 50 files, lint, build and TypeScript compilation passed. Development CI repeated these checks and passed 108 browser checks across desktop, tablet, mobile Chromium and mobile WebKit. Four existing optional historical comparisons were skipped. Development CI: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39810301042; artifact `browser-qa`, ID `12439757545`.
- Inspected desktop and mobile planning screenshots, Library/card accents, and the blue rest clock. Full print remains two Letter pages; The Thang-only remains one Letter page. Extracted text from both PDFs exactly matches the preceding verified release, preserving exercise order and counts. Rendered PDFs were inspected for clipping/readability. No new tests were skipped or assertions weakened.
- The first staging verification (run `39811629209`) was canceled after very slow Ubuntu package-mirror downloads during browser dependency installation. No browser application assertion had failed. Added a five-minute installation timeout and retried on fresh runners. Final development verification, run https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39813647813, passed 387 unit/component tests, lint/build and 108 browser checks, with the same four optional historical comparisons skipped.
- Final staging verification: https://github.com/shanematthewadams/fe-workout-planner/actions/runs/39813653098. Repeated 387 unit/component tests and 108 browser checks passed. Hosted desktop Chromium/mobile WebKit smoke passed exact commit, saved-workout identity, bookmark refresh, My Workouts reopening, Lead, 43:45 paused timer recovery/reload/Resume, no page exceptions and no horizontal overflow. Artifact `browser-qa`, ID `12441621876`, retains the screenshots, print PDFs, hosted verification and provider evaluation.
- Separate direct hosted UI check created one clearly labeled **Steel palette verification — synthetic workout**, edited/saved it, observed **Saved to cloud** with the correct blue text tint, reopened it through My Workouts and refresh, and entered Lead. Interval preparation/rest used `rgb(142, 175, 198)`; work remained gold `rgb(255, 170, 0)`. Pause stability and resume were exercised; the synthetic session was left paused. Existing user workouts were not edited or deleted.
- **Known AI limitation persists.** The separate real-provider evaluation did not pass: all three creation requests returned HTTP 504, and AI refinement could not run without a validated AI draft. The workflow emits a visible warning; its application-test success must not be read as provider success. No provider-routing, credential or validation changes were made in this design sweep. The tested client fallback/manual path remains available. Nation live read returned HTTP 200 with 21 AOs and 17 locations; reviewed AO data was not changed.
- Design release: verified on staging. Pilot decision remains **CONDITIONAL** due to the existing AI consistency/device-background limitations recorded in `PILOT_READINESS_2026-10-21.md`. No new design blocker was found. Production promotion still requires Shane's explicit approval.
