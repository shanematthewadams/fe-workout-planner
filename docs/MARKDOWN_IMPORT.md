# Markdown workout import

Open **Import Markdown** beneath the builder actions, or **More → Import Markdown workout**. Copy the chat prompt, add a workout in your preferred chat, then paste its Markdown or choose an `.md` file. Select **Review import**, check the mapped sections, exercise counts and warnings, then **Open in editor**. Only an explicit editor save adds a personal workout.

The importer runs locally without provider requests. Pasted text is recovered from this tab's session storage when available. Editing the input invalidates the preview; a slow file read cannot overwrite newer input. HTML is displayed as text. Originals are kept in the draft's existing `rawNotes` field. Every import gets fresh IDs and personal provenance. Existing backups, cloud sync, regional originals and schema version 1 stay unchanged.

## Supported format

Use one `# Workout title`, exactly one `## The Thang`, optional `## Warmup`, `## Mary` and `## Notes`/`## COT`. Use `###` block headings and an optional `Minutes: 29` or `Minutes: Unknown` immediately below each block heading. Plain directions remain text. Structured exercise rows use `- Name | exact amount | counting | instructions`. Exercise order and counting are retained. Continuation directions below an exercise are attached to that exercise. Intro metadata supports Summary, Duration, Equipment, Running, Format, AO and Q. The copyable prompt lists valid values.

Unknown times stay null. Unknown equipment and running produce review issues and do not qualify for no-gear/no-running filters. Missing AO or Q values are omitted. Inconsistent timing is flagged; no schedule or terrain is invented. Files are capped at 80 KB and input at 20,000 characters, matching the existing original-notes limit. Malformed rows, repeated sections, unknown section headings, ambiguous counting and unsupported schema sizes are rejected with correction guidance. Arbitrary Markdown tables and chat prose are not automatically interpreted as exercises: use the prompt or retain them as plain directions for manual review.

This pass also renames the app F3 Q Builder, moves the dice roll beside the description field, and uses self-hosted Google Fonts Big Shoulders Display and Manrope over a charcoal palette. Font licenses are bundled; print remains black on white. Staging only; production requires separate approval.
