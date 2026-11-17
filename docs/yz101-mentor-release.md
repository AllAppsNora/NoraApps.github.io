# YZ101 premium mentor — 2026-11-17

Prepared on branch `yz101-mentor`; frontend not published pending authenticated live acceptance.

Implemented:
- AI Mentoru dialog inside the original lesson shell; premium-only button.
- Server validates session with Supabase Auth, premium from database, and prior evaluation for task.
- 500-character question, 600-character complete explanation, fixed Turkish WaveNet-A MP3.
- No daily mentor count; concurrent requests and rapid repeated generations are throttled.
- Text and audio cached privately per account; same explanation replay does not regenerate speech.
- No lesson progress, attempts, cooldown or points changed by mentor.
- Credentials remain in Edge Function environment; never returned to browser or committed.
- `yz101-mentor` function and private cache migration deployed. Frontend remains on existing release.

Verified:
- Real Google TTS request: 200 audio/mpeg, 84,480 bytes, 10.56 seconds (ffprobe).
- 8 transport/input/output tests passed; UI dialog/audio/replay/stale account tests passed.
- Existing app welcome/login/profile/lesson/quiz/retry/points/cooldown DOM regression passed.
- SQL transaction tests: premium gate, unknown ID, RPC grants, concurrent reservation, text/audio caching. All test rows rolled back.
- Live anonymous mentor request rejected 401.
- Security advisor: mentor table has intentional RLS/no client policy, service-only access; no public mentor RPC grant.

Not yet verified:
- Authenticated complete model explanation -> playback flow; automatic approval rejected creating a disposable Auth test user because explicit creation of credentials was not authorized.
- Topic redirection and grading guidance need live model acceptance before frontend deployment.
- Full live browser visual/audio review remains pending.

Temporary smoke function disabled (JWT required and body returns 410). No test user was created. No existing accounts changed.
