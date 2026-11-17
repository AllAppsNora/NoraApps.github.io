# YZ101 premium mentor — 2026-11-17

Published to Firebase Hosting on main (frontend commit f1196227); production API acceptance completed with a disposable account.

Implemented:
- AI Mentoru dialog inside the original lesson shell; premium-only button.
- Server validates session with Supabase Auth, premium from database, and prior evaluation for task.
- 500-character question, 600-character complete explanation, fixed Turkish WaveNet-A MP3.
- No daily mentor count; concurrent requests and rapid repeated generations are throttled.
- Text and audio cached privately per account; same explanation replay does not regenerate speech.
- No lesson progress, attempts, cooldown or points changed by mentor.
- Credentials remain in Edge Function environment; never returned to browser or committed.
- `yz101-mentor` function and private cache migration deployed. Frontend deployment succeeded and live HTML loads mentor.js.

Verified:
- Real Google TTS request: 200 audio/mpeg, 84,480 bytes, 10.56 seconds (ffprobe).
- 8 transport/input/output tests passed; UI dialog/audio/replay/stale account tests passed.
- Existing app welcome/login/profile/lesson/quiz/retry/points/cooldown DOM regression passed.
- SQL transaction tests: premium gate, unknown ID, RPC grants, concurrent reservation, text/audio caching. All test rows rolled back.
- Live anonymous mentor request rejected 401.
- Security advisor: mentor table has intentional RLS/no client policy, service-only access; no public mentor RPC grant.

Live acceptance completed:
- Temporary Auth/profile account created after explicit live-testing authorization, premium gate checked before enabling the disposable profile.
- Five real mentor model requests exercised sentiment-analysis guidance and off-topic redirection. Prompt refined and Markdown removed.
- Real mentor explanation converted to 389,376-byte MP3; replay returned byte-identical cached audio with no additional speech-character charge.
- 4,628 input / 985 output Claude tokens; estimated $0.009553, below the $4 test budget. TTS 600 characters plus the earlier fixed smoke sample.
- Mentor left lesson progress unchanged.
- Firebase Hosting and Pages workflows succeeded; live root and mentor asset returned HTTP 200. Cloud browser confirmed original welcome UI and mentor script included.
- Actual premium-dialog browser playback was not visually/listening reviewed; dialog behavior was covered by DOM tests and authenticated live API/audio tests.

Cleanup verified: disposable Auth user, profile, evaluation records and mentor cache rows all zero. Temporary helper function disabled with JWT required and HTTP 410. Existing user accounts unchanged.
