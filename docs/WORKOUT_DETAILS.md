# Workout details

The builder has one shared Workout details section for both idea and formal modes. It provides optional PAX count, grouping, body focus, running preference, workout date, expected light, and expected weather. The top header credit and Gold Rush example button/placeholder have been removed; the footer attribution remains.

Selections are stored with the assistant session and sent in a validated `planning` request object. Existing clients without this object remain supported. PAX can remain unknown; a number stated as “17 guys” or “17 PAX” is used when the count field is blank. Structured selections take precedence when supplied.

The provider context explains odd turnout handling, balanced groups, explicit individual/shared counts, focus, and condition-dependent adaptations. A one-person or individual-work request rejects obvious partner dependencies even if output metadata says Circuit. Date and expected light remain separate: no forecast, geolocation, or sunrise/sunset lookup has been added. All conditions are Q-supplied expectations; they never establish unconfirmed AO lighting, surfaces, or shelter.

Refinements retain unmentioned details. Explicit common count, focus, grouping, rain, and light revisions update the stored planning request; this is conservative phrase handling, not a complete language parser.

Offline templates support focused main-work station selections, practical group notes, and standing alternatives for rain/snow/ice. Some explicit style templates remain broader than the selected focus and continue to identify themselves as templates requiring review. Running, terrain, session timing, backups, and free-provider policy retain their existing checks. No saved-workout or database schema changed.

Changes are developed on `studio/ux-streamline`. Production publication requires Shane's separate approval.
