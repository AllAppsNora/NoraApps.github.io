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

## Lesson points — 2026-11-17

Each fully completed lesson earns 100 points once in the server-owned score ledger. A unique user/lesson index prevents repeat awards. Completion and award commit in the same transaction. Existing completions are backfilled; existing accounts, progress and cooldowns are unchanged. Lesson points appear on the home screen and +100 in the successful result dialog. Legacy score entries remain untouched.

Extended SQL tests passed: failure earns zero, success after retry earns 100, repeated completion earns no more, and 15 completed lessons earn exactly 1500. DOM tests passed for the reward dialog and total after session reload. No provider calls. Live browser tool remains unavailable.

## Main application integration — 2026-11-17

Added Learn / News / Profile navigation, grouped lesson journey, existing profile and goal editing, mascot selection, account password reset/recovery, notification/legal/support links, full news text, rolling 24-hour news allowance and rankings for all time/week/month. Combined points reuse the established score ledger; no reward is duplicated. Existing stored proficiency levels and legacy progress remain unchanged, since the 15 lesson groups are not equivalent to the six legacy proficiency exams. Profile deletion is not exposed in this integration; existing deletion endpoints were not modified.

`integrated-app.sql` passed in a rolled-back transaction: profile ownership and protected level/premium, preserved progress, combined totals, 10-point news award and idempotency, rolling news cooldown, full text field, disabled QA-account exclusion from ranking, and unauthenticated denial. `integrated-ui.mjs` passed with mocked APIs: navigation, journey, profile changes, full article escaping and URL filtering, points, cooldown, ranking periods and password link flow. Updated compact lesson DOM regression also passed. No paid AI calls and no real account/profile changes during testing. Connected-browser visual verification remains unavailable.
