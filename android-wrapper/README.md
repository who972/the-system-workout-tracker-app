# THE SYSTEM Android wrapper

Native Android shell for THE SYSTEM web application.

It provides the `SystemHealthNative` WebView message channel consumed by `health-connect.js`.

## Health Connect
Phase 1 reads steps, exercise sessions, active/total calories, heart-rate average/min/max, distance, and sleep. Open HEALTH CONNECT in the HUD telemetry block. Connect requests granular permissions; Refresh reads foreground data; Settings opens Health Connect or its install page. Partial access is supported. The existing steps bridge and manual entry remain compatible.

Daily totals use the local day and Health Connect aggregation. Session reads paginate. Sleep uses a rolling 24-hour window, retaining source and interval rather than summing overlapping sleep sessions. Records remain in panel memory and are cleared on close. This integration does not upload records or award workout XP.

Samsung setup: sync the Galaxy Watch to Samsung Health, enable Samsung Health sharing with Health Connect, then grant The System read access. This is phone-based synced telemetry, not live watch heart rate or a Wear OS app.

Device validation before release: test unavailable provider, install/update, deny all, partial grant, grant all, revocation, empty data, overnight sleep, refresh, and manual step entry on API 28–33 and 34+. Verify reported totals against Health Connect and Samsung Health. The separate android-health-connect sample is not the distributed APK; android-wrapper is the production target.

## Web content
Before building, copy the deployed web application files into `app/src/main/assets/www/`. The Android activity loads `https://appassets.androidplatform.net/assets/www/index.html` through WebViewAssetLoader.

## Build
Use JDK 17 and Android SDK 36, then run `./gradlew assembleDebug` after adding the Gradle wrapper or import `android-wrapper` into Android Studio.
