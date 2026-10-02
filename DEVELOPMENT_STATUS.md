# The System — v54 development status

Prepared on October 2, 2026, on branch `fix/v54-health-landscape`.

## Changes ready for validation

Reconciled current main with the later Health Connect, responsive window, briefing and workout-flow fixes. This retains main's dynamic health-link direction and topbar collision fix, together with the established landscape OS, orbit, two-row dock, capped initial classification, solo workouts and individual Train Together progression.

HEALTH now contains eight readings: steps, active calories, total calories, distance, average heart rate, exercise sessions, sleep sessions and recorded exercise time. The exercise logger remains available in DATABASE. HUD and HEALTH use the same foreground read. Permissions, empty records, valid zero, partial failures and unavailable providers have separate states. No permission dialog opens automatically. Close/reopen, revoked permission and previous-day responses cannot publish outdated readings.

The production native wrapper includes all seven read permissions and the permissions rationale activities. Exercise time uses the Health Connect duration aggregate. The compatibility `getTodayMetrics` method is implemented in the production wrapper. Android package identity and persistent signing configuration are preserved; target update is version 54.

Restored fixes cover entry-before-assessment sequencing, compact briefing, responsive module windows, saved solo workout inputs/countdowns/rests, and actual completion rewards. Native health data does not award workout XP. Existing manual step entry is retained.

## Passed locally

- 32 JavaScript/DOM tests covering health transport, metric states, stale responses, panel lifecycle and account operations.
- Production solo and two-player Train Together integration tests against isolated PostgreSQL, including private player progression, retries, capacity and cancellation.
- Database migration/reset/deletion tests covering isolation, authentication, rollback, privileges and cascades.
- JavaScript syntax, stylesheet parsing, Android XML parsing, required APK web asset presence and whitespace checks.

## Still required

- Browser layout tests across ten landscape sizes, entry/briefing/onboarding and solo countdown/resume UI checks.
- Native compilation, Android lint, native unit tests, signed APK build and packaged-asset/signature verification.
- Actual Samsung Health/Galaxy Watch readings on a physical phone; mocked health transport cannot establish which records Samsung is sharing.

Local Chromium cannot start because the execution host denies its required socket operations. This host has no Android SDK or persistent signing key. The existing GitHub Actions workflow has been prepared to run browser tests, native checks and the signed build, and save a landscape preview.

The branch has **not** been pushed. Automatic approval review rejected the push because it classified external repository publication as outside the development/testing authorization. Approval to push this exact prepared branch is required before using that workflow. No merge or app release is needed to run the branch build.
