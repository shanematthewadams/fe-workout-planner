# Source decisions · October 15, 2026

All ten starter plans and their plain-language instructions were written for this prototype. They are illustrative templates, not records of actual beatdowns. No Q, AO, event date, completion record, or testing history is claimed. The record timestamp is an editorial metadata timestamp, not an event date. Common F3 exercise names are paired with original plain instructions. No national catalog descriptions, CSV records, source code, logos, photos, or IronPAX workouts were copied.

References checked through current web retrieval:

- https://f3nation.com/exicon — public page retrieved; catalog entries were not exposed in the retrieved text. Footer reserves rights. Link provided in the app; no entry import.
- https://f3nation.com/lexicon — public page retrieved; no full glossary exposed in text. No glossary import.
- https://github.com/F3-Nation/the-codex — public repository found; no license identified in retrieved repository page. Earlier CSV discovery is not treated as a reuse grant. No code/data import.
- https://github.com/F3-Nation/Website-Widgets — repository page found; no license identified in retrieved page. No code import.
- https://github.com/F3-Nation/f3-nation — repository page lists AGPL-3.0. No code imported or derived from it.
- https://ironpax.f3greenwood.org/ — endpoint retrieved, with no substantive workout text available through the retrieval. No IronPAX content imported or presented as a starter.

Before Sprint 2 imports, verify the exact file-level license or get permission from the relevant content owner; confirm attribution and any code/data distinctions. Public visibility alone is insufficient evidence of reuse permission. Keep backblast provenance (source link, Q/AO/date only when actually supplied), import status, counting ambiguity, adaptation notes, and human review separate from the original text.

Dependencies are declared and pinned in package.json/package-lock.json. Fonts are bundled from Fontsource (DM Sans and Barlow Condensed); there are no third-party font requests at runtime. Lucide provides interface icons. This app uses a custom typographic FE mark, not an imported F3 logo.

## Regional styling reference

Shane requested f3thefe.com as the visual reference. The live site was inspected on October 15, 2026: black header, white canvas, bold geometric headings, restrained monochrome palette, thin divider rules. Browser-computed headings used a Tektur Tight family name and body/navigation used Hezaedrus. This app uses the openly distributed Tektur font from Fontsource as a related geometric display face, with DM Sans for readable workout instructions. It does not copy the site's font binaries, photographs, logos, theme code or page content. Tektur's license is included in public/licenses. Links point to the verified regional home and AO schedule pages.

Typography update: Shane subsequently rejected Tektur's geometric look and chose Barlow Condensed for headings plus DM Sans for interface/body text. Both are Google Fonts, self-hosted from Fontsource. Tektur was removed; its earlier styling note above is historical, not the current font choice.
