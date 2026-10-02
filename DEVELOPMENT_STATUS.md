# The System — v56 Command layout

Prepared October 2, 2026, on `fix/v56-command-layout`, based on v55.

Central Command measures the header and two-row dock before sizing the right-side Mission, Telemetry, and Analysis panels. Compact spacing and a two-column analysis keep standard landscape layouts above navigation. On unusually short screens only the right panel stack scrolls within its reserved space. Left panels use the same reserved dock space. The task switcher stays in its side gutter so it cannot cover Missions. Alerts remains the friend/duel/squad notification inbox; Briefing remains the daily plan.

Validation: all dock buttons are hit-tested and Alerts opens/closes at 11 sizes from 568×240 to 1536×681. Right panels stay above the dock, card contents are not clipped, and standard landscape sizes need no panel scrolling. Existing module-window and Health history browser checks pass. Android version 56 / 0.56. Full regression, Android build, lint, native unit tests, signature, and packaged-asset verification passed in GitHub Actions run 37071399987 (commit 750f6b2328115b85c783804b45e85ba52d1d66ed). Artifact SHA-256: a31398ec74c03b68074d7c3275280b89011493e18fd0d060f68a9cea12edf252. Existing signing certificate retained. Delivered The-System-v56-Command-Layout.apk.

# The System — v55 Health history

Prepared October 2, 2026, on `feat/v55-health-history`. Based on the validated v54 Health/landscape branch; main has not been merged or released.

## Added

HEALTH offers TODAY, 7 DAYS, 14 DAYS, and 30 DAYS. History has interactive daily charts for steps, active calories, total calories, distance, average heart rate, recorded exercise time, and sleep time. Tap or keyboard-select a day to read its value. Daily averages exclude today and missing records. Today is labeled partial. Missing records remain gaps and recorded zero remains zero. Sleep duration is allocated to local calendar days, including overnight sessions.

The production native bridge reads daily aggregate buckets from Health Connect using local calendar periods and source priorities. Each metric has independent permission and read-failure handling. No added permissions, automatic permission prompts, background collection, local health archive, or workout XP are introduced. Historical reads do not replace today's HUD values.

Closing/switching modules, hiding the app, returning to TODAY, and changing range invalidate pending history responses. Reopening refreshes permissions and data. Local day/offset changes and stale day responses require a new read. Health sharing instructions now cover compatible watch brands. Android update version: 55 / 0.55; existing application identity and signing key retained.

## Validation

- v54 passed browser/workout/database integration, Android compilation/lint, signature and packaged-asset checks in GitHub Actions run 37066373292.
- v55: history model/transport/DOM tests and existing HEALTH tests pass locally.
- History charts: 7/14/30 days × seven metrics × ten landscape sizes (568×240 through 1024×500), keyboard selection, zero/gaps, return to TODAY, and permission revocation pass.
- All 11 module windows, HEALTH today, classification layout and reduced-motion checks pass at ten landscape sizes.
- Native calendar-range unit tests pass for bounds, timezone dates, and both daylight-saving transitions.
- Signed v55 Android build, lint, native unit tests, signature and packaged-asset verification pass in GitHub Actions run 37068622981 (commit 62d95600a2c7fb1a8b6bbf3486c30edccc743e6d). Artifact SHA-256: ae5b25cb278c934009f19b6575b4c8f85c9f7608c38fcbf956f5f489243f8924. APK delivered as The-System-v55-Health-History.apk.
- Actual phone readings remain a physical-device check; watch apps must share the corresponding records with Health Connect.
