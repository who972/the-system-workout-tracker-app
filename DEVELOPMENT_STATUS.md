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
- Native calendar-range unit tests added for bounds, timezone dates, and both daylight-saving transitions; will run with Android compilation/lint in CI.
- Signed v55 build and package verification: pending.
- Actual phone readings remain a physical-device check; watch apps must share the corresponding records with Health Connect.
