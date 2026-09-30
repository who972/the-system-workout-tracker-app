# THE SYSTEM — Workout Tracker

Static workout tracker web app. Open `index.html` through a local web server to develop, or deploy the repository root as a static site.

## Local preview

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000` from the project directory. The service worker requires localhost or HTTPS.

## Deployment

For Vercel, import this repository as an **Other** framework project. Leave the build command empty and set the output directory to `.`. No dependencies or build step are required.

Workout data is stored on the device in browser local storage. The optional cloud backup UI requires the user to configure a Supabase project and account; publishing this site alone does not enable cloud sync.

## Account & Data

Profile → Settings → Account & Data contains separate operations:

- **Factory Reset** clears only this app's device storage, session, settings, onboarding and caches. It signs out without calling a cloud endpoint. Saved cloud progress and the account remain; unsynced device data is lost.
- **Reset Progress** requires `RESET`, resets training/XP/rank/bosses/streaks/achievements, and resumes Initial Assessment. Profile, settings, custom workouts/exercises, weight goals and account remain. For signed-in users the transactional cloud reset must succeed before local data changes. Past competitive results and shared squad trophies remain historical.
- **Delete Account** requires the current password and `DELETE`. The Edge Function verifies the signed-in user's password and calls a service-role-only transaction to delete the auth user and server data. Device data is cleared only after server success. Owned squads are deleted through the existing cascade rules.

Before releasing these cloud operations, apply `supabase/migrations/20260929190000_account_data.sql` and deploy `supabase/functions/delete-account`. The function uses Supabase's server environment keys; never put a service-role key in app assets. Until deployed, server errors preserve local data.

Validation:

```sh
node tests/account-data.test.cjs
node tests/health-connect.test.cjs
# Install @electric-sql/pglite in a temporary directory, then:
PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite node tests/account-data-db.cjs
```

The database test uses an isolated PostgreSQL runtime, loads the migrations, and checks reset isolation, rollback, authentication, deletion permissions and cascades. It does not touch live accounts.

## Train Together

From BEGIN MISSION / the workout briefing, choose TRAIN TOGETHER, then HOST SESSION
or JOIN SESSION with the host's code. Two signed-in players follow the host's
workout and advance when both have completed the current set. Reps, weights,
records, XP and account progression stay individual. XP uses each player's own
mission reward scaled to the shared workout mode. Solo LAUNCH MISSION is unchanged.
Sessions expire after four hours; exiting cancels the shared session. Connection
failures retain entered sets and allow safe retries. Session synchronization polls
Supabase every 1.5 seconds while connected. Reloading the app ends the local link;
start a new session after a reload. Saved individual entries remain available.

Apply `supabase/migrations/20260930010956_train_together.sql` before releasing.
Clients can only read sessions they participate in; authenticated RPCs enforce
joining, two-player capacity, readiness, expiry and cancellation atomically.
No reps or weights are stored in the shared table. Existing private backup and
social profile sync paths continue to handle individual account data.

The Android packaging workflow includes `train-together.js`. To run the integration
test, install `@electric-sql/pglite@0.3.14` and `jsdom@26.1.0` in an isolated test
folder and point these environment variables to their module directories:

```sh
JSDOM_MODULE=/path/to/node_modules/jsdom PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite node tests/train-together.test.cjs
```

This exercises production solo start/set/finish functions and the cooperative UI
against migrated PostgreSQL, including separate player storage/rewards, network
failure, retries, membership, capacity, cancellation and expiry. It does not replace
a live two-device check after migration deployment.
