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

Shane requested f3thefe.com as the visual reference. The live site was inspected on October 15, 2026: black header, white canvas, bold geometric headings, restrained monochrome palette, thin divider rules. Browser-computed headings used a Tektur Tight family name and body/navigation used Hezaedrus. An early styling pass used the openly distributed Tektur font from Fontsource as a related geometric display face, with DM Sans for readable workout instructions. It does not copy the site's font binaries, photographs, logos, theme code or page content. The current Barlow Condensed and DM Sans redistribution licenses are included in public/licenses. Links point to the verified regional home and AO schedule pages.

Typography update: Shane subsequently rejected Tektur's geometric look and chose Barlow Condensed for headings plus DM Sans for interface/body text. Both are Google Fonts, self-hosted from Fontsource. Tektur was removed; its earlier styling note above is historical, not the current font choice.

## Sprint 2 source verification · October 16, 2026 (UTC)

The full public F3-Nation organization listing (23 repositories) was inspected, including non-pinned projects. Current useful references are f3-nation, Website-Widgets, the-codex, pax-vault, f3nearme, database-helpers and f3-region-pages. Older org-map, data-model, nation-slack-bot and several map repositories are explicitly archived/deprecated; they are not integration dependencies.

| Repository | Last push inspected | License / use decision |
| --- | --- | --- |
| f3-nation | 2026-10-16 | AGPL-3.0; API contract reference only, no code copied or derived |
| Website-Widgets | 2026-10-13 | No repository license detected; examples inspected, no code copied |
| the-codex | 2026-09-22 | No repository license detected; CSV existence and selected names verified, no bulk description import |
| pax-vault | 2026-10-14 | No repository license detected; analytics reference, no dependency or data import |

All four are unarchived. Check again before future imports: activity is a dated observation, not a support guarantee. GitHub's null license field does not establish permission or prove there is no file-level grant. No broader content reuse grant was established for backblasts or national descriptions.

The current live API specification at https://api.f3nation.com/docs/openapi.json was downloaded and inspected. It confirms pageIndex/pageSize (max 100), event-instance metadata list and `/id/{id}` detail route. Upstream source explicitly selects narrative fields in detail, but an unauthenticated real request returned 401: FE narrative completeness, date serialization, Q/attendance mapping and exact populated response remain **not live verified**. The independently implemented CLI must be checked against an authenticated response before claiming a live integration. The API README points to https://admin.f3nation.com/api-keys; widget instructions still mention the older map-admin Settings → API path.

The FE homepage, official schedule and publicly indexed AO pages were retrieved. https://f3thefe.com/feed/ returned an RSS channel with no items; `/wp-json/wp/v2/posts?per_page=1` returned 404. Focused public searches found schedule/AO descriptions, not complete regional backblast narratives. **Zero actual regional workouts were extracted or published.** This is a source-access limitation, not evidence that the region has no backblasts. Private Slack was not read or republished.

The AO snapshot contains only schedule facts: 16 unique names, 17 weekly sessions, public locations, start times, session length/type and check timestamp. It is not a live F3 Nation sync. Local walls/hills/stairs/distances/lighting/coupons/weather attributes are all unknown and stored separately. No site prose, photographs, contact details, site Qs or health/prayer information was copied. The Gathering detail page has a Thursday heading despite describing Saturday; the snapshot follows the official schedule's Saturday listing and exposes the source.

The exercise guide checks nine names against visible `the-codex/exicon.csv`: Al Gore, American Hammer, Burpee, Carolina Dry Docks, Derkin, Dips, Flutter kicks, LBCs and Mountain Climbers. Instructions are short original descriptions of the movements, with separate aliases/equipment/counting guidance and links to the CSV plus official Exicon/Lexicon. No source description text, video, image or CSV bulk data is redistributed. Regional counting is not assumed. Exact stable individual Exicon entry IDs were not established, so links target the visible source file instead of invented deep links. Full national description reuse remains unresolved.

https://f3nation.com/exicon and /lexicon remain public entry pages without an established bulk reuse grant; https://ironpax.f3greenwood.org/ returned no substantive workout content through retrieval. IronPAX workouts are neither FE originals nor imported here. Preserve author/source permission separately from API credentials: technical access does not establish permission to republish private records.
