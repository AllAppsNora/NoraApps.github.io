# YZ101 compact lesson release — 2026-11-16

Three stages (Learn / Practice / Test), 15 manually authored warnings and hints, no additional provider calls for lesson content. Quiz answers and explanations are not shipped in the new lesson asset. Test outcomes appear in a dialog without revealing answer choices.

Free accounts share one server-side counter: successful lesson or second educational failure starts a rolling 24-hour cooldown. Expiry resets failures. AI and quiz failures use the same counter; technical failures do not. Premium accounts bypass this learning limit. Provider-wide budget guard remains. Successful AI evaluations are reused. Submission IDs prevent double counting after a network retry. Existing Auth identities and progress are retained.

Validation:
- `tests/lesson-access.sql`: passed against Supabase inside a rolled-back transaction using an existing disabled QA account. Covers prerequisite, AI gate, incomplete input, 45 quiz keys, 4 numeric exercises, success/failure cooldown, expiry, premium, idempotency, shared counter, technical failures, privileges.
- `JSDOM_PACKAGE=/tmp/yz101-dom-tests/package.json node tests/compact-ui.mjs`: passed using jsdom 26.1.0. In another environment, install jsdom and omit the environment override. Covers stages, hints, feedback, result dialog, technical retry identity, cooldown, and answer-key removal.
- `node tests/grader-feedback.mjs`: passed with mocked provider; preserves long feedback and repairs old truncated cached sentences.
- `node --check portal/yz101/pilot.js`, `git diff --check`: passed.
- Connected Chrome tool unavailable during this release; live visual inspection remains unverified. DOM checks are not a substitute for browser layout verification.
- Zero paid provider requests in this revision.

The prior `pilot-navigation.mjs` and `pilot-api.py` describe the retired pilot UI/API and are superseded for this release by the checks above.
