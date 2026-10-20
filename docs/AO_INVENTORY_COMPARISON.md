# Post-summit inventory comparison

Prepare source-backed JSON using `docs/examples/ao-inventory.json`. The example is illustrative, not an actual report. Then run:

```sh
npm run --silent catalog:compare-inventory -- --input docs/examples/ao-inventory.json > /tmp/ao-review.json
```

This extends the existing offline AO proposal process with a read-only comparison. No network, Sheet edits, scheduled sync, database updates or publication occurs. There is no `--apply` option. Use the existing `scripts/review-aos.ts` process only after regional review and conversion of supported facts into an AO proposal; additional permission/distance facts need an explicit application schema change before publication.

Each report identifies `aoId`, optional `venueId`, reporter, HTTPS source and real review date. `facts` accepts `name`, `siteQs` (all Qs and co-Qs), `accessNotes`, `landmarks`, `venues`, `season`, `access`, `features.<feature>` and `amenities.<amenity>`, plus separate `lightningShelter`, `indoorCoffeeteria`, and `indoorWorkoutPermission`. Unsupported fields/values are retained and flagged, never coerced. Null or explicit unknown remains unknown.

Landmarks retain `reported`/`confirmed`, `workout`/`gathering`/`nearby`, restrictions, and optional `distance: {value, unit: "meters" | "miles", certainty: "approximate" | "confirmed" | "unknown"}`. Cover does not imply lightning shelter. Coffee access does not imply permission for indoor workouts. Venue facts never inherit from another seasonal venue. Unscoped seasonal amenities and unrecognized AO/venue identities require clarification.

The result groups facts by AO/venue and marks them unchanged, added, changed, removed, unknown, ambiguous, conflicting or unsupported. Every claim retains its source and review date beside baseline source references. Contradictory reports remain visible; a newer date never silently wins. Omitted facts/rows do not mean removal. Explicit empty arrays propose removal of a roster, venue or landmark list for review. Compare complete lists when proposing list changes. Review the retained before/after lists to see additions and removals within them. Name changes require the existing AO ID; do not guess identity from similar names.
