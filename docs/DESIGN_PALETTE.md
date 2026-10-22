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
- Focus indicators on the red rail remain white. Printed Q sheets remain monochrome and keep the existing layout/counting rules.

## Contrast

Calculated with WCAG relative luminance: the selected `#527d9c` is 3.85:1 on the ground and 3.25:1 on the input/card surface; it is suitable for supporting lines, not normal-size text. The readable `#8eafc6` tint is 7.34:1 on the ground, 6.20:1 on surfaces, 5.24:1 on raised surfaces, and 5.45:1 on the blue badge background. This tint also provides focus contrast. Labels and icons accompany state information.

Shared tokens and general UI rules live in `src/style.css`; library, movement, import and Lead-specific rules live in `src/library.css`. No new dependencies, data formats, provider calls, authentication or infrastructure changes are needed for this palette.
