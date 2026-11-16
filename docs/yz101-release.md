# YZ101 pilot verification — 2026-11-16

Live target: https://noraapps.web.app/yz101/ · Firebase project `k1nday`, site `noraapps`.

## Fixes

- Treat cached Claude `completed` responses as evaluations, without charging again.
- Align the browser's answer length validation with the server's 40–1600 character range.
- Display clear daily/task/budget/error messages and saved quiz/AI/numeric status.
- Preserve in-tab drafts while changing lessons; clear drafts and state on account changes.
- Use the originating lesson draft for asynchronous saves and guard account changes during evaluation.
- Align all 15 server-side grading rubrics with the visible task and criteria. No added hidden requirements.

## Evidence

Tested through connected Chrome and authenticated REST calls, using three isolated fixtures with five lessons each. Existing daily quota (5 evaluations per user), per-task quota (2), and global budget were unchanged.

- Password sign-in, sign-out, refresh and account isolation passed.
- All 45 question choices tested in Chrome; server rejected each of 45 individually incorrect answer sets before accepting all 15 correct sets.
- P08=300, P11=60, P12=98, P15=300: correct numeric results accepted in Chrome and REST; missing and incorrect numeric values rejected in REST.
- All 15 actual Claude evaluations passed. All 15 corresponding lesson progress rows completed (5 per test account).
- Reload retained completed state. Cached resubmission reused the result; evaluation count remained 15.
- Short-answer validation and daily-quota message passed.
- Anonymous progress access and authenticated access to the internal budget-control RPC were denied.

Recorded Claude usage: 6,157 input tokens + 2,027 output tokens; server-calculated cost **$0.016292**, below the $4 test cap. This is application usage accounting, not a provider invoice.

Baseline: 130 existing auth accounts and 116 YZ101 profiles; zero legacy module-progress and pilot-progress rows were present at test start. Existing account/password fingerprint was preserved. Test credentials are not committed.

## Regression script

`python tests/pilot-api.py /path/to/private-fixtures.json`

Fixture file requires three fresh isolated test accounts with `email`, `password`, `token`, `id`. The script must run before those accounts have passed their assigned lessons because pass state is intentionally monotonic. `tests/pilot-answers.json` contains synthetic browser test responses. The API script does not call Claude.
