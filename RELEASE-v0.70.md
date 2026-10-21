# Version 0.70 — tested fixes and rollout

Version 0.70 includes the tested fixes below. Apply the database migration only after the signed Android build passes.

## Fixed

- Account-owned local saves and sync timestamps prevent one user's workouts moving into another account. Account switches and imports roll back on storage failure; malformed imports are rejected. Exports exclude account archives and session credentials.
- Editable/imported workout names, exercise-library fields, record text, and meal text render as data. Custom workout, library, and progression buttons use dataset event handlers instead of inserting user strings into executable handlers. Toast messages are escaped.
- Assessment effort/variation selections preserve entered minutes and repetitions. Mobility selection registers and affects the score. Instructions and countdown use one side of the screen; the controls and fixed footer fit at all ten tested landscape sizes (568x240 through 1024x500).
- Health Connect availability and construction failures no longer stop native startup. A missing provider returns a controlled error. External pages open outside the app WebView so they do not inherit native bridges.
- Password recovery supports pasting the email's Supabase reset link directly into the app. It validates the project origin, recovery type and token before exchanging it. An invalid/expired link does not remove the prior session. Password changes use the recovery token; login is cleared only after a successful change.
- Database migration enforces recipient-only friendship acceptance, immutable participants/rules, server timestamps and server-calculated duel/squad results. Late finalization excludes workouts after the challenge end.
- New competition points are separate from historical personal XP. The first completed online guided workout each UTC day earns 40 (light), 70 (intense), or 100 (full) points. A server-created credit must be at least one minute old. Retries award once; direct client score edits are rejected. Personal XP/offline workouts remain available. Existing personal progress is not converted or erased.
- Unnecessary API EXECUTE grants on trigger functions are revoked by the migration.

Competition credits limit software score manipulation; they do not prove that a person physically exercised. Switching modes after the day's credit has started does not change its server-recorded mode, and subsequent workouts that UTC day do not earn another competitive credit. These rules are deliberately separate from personal XP and same-day personal workout upgrades.

## Validation

- Full repository suite: **48 passed, 0 failed**, including onboarding layouts, input preservation/scoring, workout flows, Train Together, health bridge/dashboard, recovery, malicious rendering, account isolation and SQL authorization.
- Native Kotlin/JUnit health-logic suite: **10 passed**, compiled with Kotlin 2.0.21, JDK 17 and JUnit 4.13.2. Tests cover provider absence/failure and provider-source selection.
- Assessment screenshots inspected at 740x360. No clipped controls in the full ten-size browser regression.
- SQL regressions apply all migrations to an isolated PostgreSQL-compatible database. They exercise the actual production trigger/RPC code with separate user roles, including forged friend acceptance, arbitrary XP, duplicate credit claims, early completion, cross-account access, premature/fabricated duel results, late result finalization and squad consent/rule protection.
- JavaScript syntax checks and git diff whitespace checks pass.

## Rollout sequence

1. Upload this tested source to https://github.com/who972/the-system-workout-tracker-app using the existing signing/build workflow. The workflow now runs the new regressions and verifies competitive-credits.js is packaged in the APK.
2. Obtain the signed v0.70 APK and confirm its signing certificate matches v0.69; install over v0.69 without uninstalling.
3. Apply supabase/migrations/20261021013751_secure_social_credits.sql to project wczmxbvdfctffhpohnne. This adds a private credit ledger, a restricted competitive view, consent/result guards and API-grant hardening. Review advisors afterwards.
4. Verify with two real accounts: sign-in/out, saved progress, friendship consent, online completion credit, and real email recovery. Test startup on Android with and without Health Connect, as well as actual touch/keyboard layouts.

Older APKs will no longer be allowed to push their local XP directly to the competitive profile after the migration; distribute the updated APK alongside the database change. New competitive standings begin at zero while personal XP/history remain intact. A read-only live check found no pending or active individual or squad challenges, so there is currently no in-progress competition to transition. Recheck at rollout; the migration does not silently erase challenge history.

## Still requires external/device verification

The full Android build and native unit tests passed on GitHub. Physical-device installation remains to be verified. Real email delivery and a handset recovery flow were not exercised. No recovery email was sent. Leaked-password protection is still a separate live Supabase authentication setting and has not been changed; do not enable a paid feature without checking plan requirements.



## Deployment record

The signed APK was built successfully from commit aef71f668e4c245c6c7dc82145fddceedf9e32f4 in GitHub Actions run 39528093751. The packaged source matches the tested files, and its signing certificate matches v0.69.

APK SHA-256: 8d341e9656e8c2b92fe95c92d0a608772d4dda098be123fc262921cefd89c4ab.

Database migration secure_social_credits was applied successfully as version 20261021013751. Live checks confirmed the invoker-security view, private ledger access restrictions, four installed guards, rejected arbitrary XP and pre-accepted friendships, and rejected credit requests without an existing profile. All test probes were rolled back.

The advisor no longer reports publicly executable trigger functions. Remaining notices are the intentionally closed private ledger, the intentional signed-in reset RPC, and optional leaked-password protection being disabled. References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
