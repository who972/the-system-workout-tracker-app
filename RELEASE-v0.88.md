# v0.88 — Personalized training

Built on the v0.87 health/sleep development branch. The phone can remain on v0.85 while this update is prepared. A signed APK has been built with the persistent signing key. Package and signature checks passed; installation over v0.85 still needs verification on the phone.

## Changes

- Bodyweight, weightlifting and alternating hybrid training paths chosen before assessment.
- Goal, experience (including returning lifters), equipment, days, session duration, movement exclusions and smallest weight increment.
- Existing-user training setup preserves rank, assessment and workout history. Active sessions retain their prior prescription.
- Full-body or upper/lower sessions selected from shared home/gym history. Gym swaps preserve movement focus; substitutions respect equipment and exclusions.
- First-time lifting guidance finds working loads without converting bodyweight tests into pounds or using a personal record as a starting weight.
- Optional repetitions-in-reserve feedback saved per set. Two complete sessions with sufficient reserve are required before suggesting an increase. Missing feedback and quick sessions do not trigger increases.
- Reduced volume for reported fatigue, poor sleep or soreness; recovery spacing, scheduled rest and conservative return-after-break load suggestions. Pain blocks starting training.
- Prescriptions freeze when a session starts; normal history, XP, account separation, backup/reset and sleep behavior remain intact.

## Verification

- Personalized policy tests: equipment, exclusions, recovery spacing, readiness, unknown starting loads, progression, missing feedback, quick sessions and return after a break.
- Actual-script DOM integration: onboarding through assessment, existing-user profile setup, mission generation, session freeze, logged set feedback, workout completion and history/XP flow.
- Existing account-data/reset, account-isolation, endurance assessment, session-equipment, health-dashboard, sleep-tracker and health-insights tests passed.
- JavaScript syntax checks and git whitespace validation passed.

## Remaining checks and limits

- Remote browser checks passed for onboarding across ten landscape sizes and new workout controls at 568×256, 740×360 and 915×412. Preview images were inspected.
- Signed APK compilation, unit/integration tests, packaged-asset verification and signature verification passed in build 40392088043. v0.85-to-v0.88 installation needs verification on the phone.
- The user authorized publishing the development branch; changes are on adaptive-training. The build workflow includes the new module and tests.
- Readiness currently uses the user's check-in. Sleep tracking remains available; sleep measurements do not automatically prescribe training loads.
- Weight entry is in pounds, with dumbbell weight per dumbbell and barbell weight including the bar. Hybrid defaults to alternating home and weighted sessions.
- Existing general assessment remains the baseline; exercise-specific starting loads are calibrated in the lifting session. The engine does not estimate one-repetition maximums.
- Easier training uses readiness/workload checks, not a complete periodized training-cycle planner. Bodyweight progression currently increases repetitions; automatic promotion to harder movement variations is not implemented.
