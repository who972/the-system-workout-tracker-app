# THE SYSTEM Android + Health Connect

This is a runnable Android WebView host for the repository's PWA, replacing the original snippets. It bundles the current web assets at build time and loads them at `https://appassets.androidplatform.net/assets/index.html`; a browser-installed PWA cannot access Android Health Connect.

## Build

Use JDK 17 and Android SDK platform 36 (Android Studio can install both). From this directory:

```sh
./gradlew :app:assembleDebug :app:lintDebug :app:testDebugUnitTest
```

On Windows use `gradlew.bat`. Set `ANDROID_HOME` or put `sdk.dir=/your/sdk/path` in the ignored `local.properties`. Output: `app/build/outputs/apk/debug/app-debug.apk`. Release distribution requires your own signing key and Play Console declarations/privacy policy for Steps read access. The debug APK is for device testing.

The Gradle build copies an explicit list of root web files into generated assets; rebuild the APK after web changes. Android uses packaged assets directly without a service worker. The ordinary PWA retains its service worker and manual step entry. The Android app has separate local storage from the browser PWA; installing it does not automatically migrate browser workout history. Existing optional cloud backup can be used to transfer data.

## Device setup

1. Install the debug APK on an Android 9+ phone (for adb: `adb install -r app/build/outputs/apk/debug/app-debug.apk`). Allow installation from the app delivering the APK if sideloading.
2. On Android 9–13 install/update Google's Health Connect app. On Android 14+ it is part of the system. Update Android System WebView if the sync button is missing.
3. Make sure your step source, such as a watch/fitness app, is writing Steps to Health Connect. A successful read can return zero when no steps are present.
4. Open THE SYSTEM, go to Step Hunter when it appears in daily missions, and tap **SYNC HEALTH CONNECT**. Grant **read Steps** when prompted. Only after that result returns does the app read today's aggregate.
5. Tap sync again for a fresh total. There is no background polling, background permission, history permission, or Health Connect write access. Manual entry remains visible even after granting access. Revoking permission or declining it leaves saved steps intact.

## Bridge and privacy

`health-connect.js` exposes `window.AndroidHealthConnect.requestStepPermission(): Promise<boolean>` and `getTodaySteps(): Promise<{steps:number,date:string}>`. The PWA also accepts a host exposing `HealthConnectBridge`. The native transport uses AndroidX WebKit's origin allowlist and accepts only main-frame messages from the bundled HTTPS origin. External pages open outside this WebView and cannot call the bridge. Permission launch/results run through the Activity Result API; Health Connect calls use lifecycle coroutines.

Each read rechecks Steps permission and aggregates `StepsRecord.COUNT_TOTAL` from the start of the current local calendar day to now, without a data-source filter. This avoids counting overlapping sources twice. Permission denial, unavailable/outdated provider, exceptions, invalid responses, timeouts, changed dates, and stale responses after manual edits do not turn into zero steps. A legitimate zero is saved.

The daily total is saved in existing app local storage and feeds existing Step Hunter progress. Explicit backup/export and cloud sync include local storage, including this total. The native reader itself does not upload records. Android backup is disabled. The permissions-rationale screen explains this behavior on both Android 13 and Android 14+.

## Validation

From the repository root:

```sh
node --test tests/health-connect.test.cjs
node --check app.js
node --check side-system.js
node --check health-connect.js
node --check sw.js
```

On real devices, test grant, denial, revoke/regrant, provider missing/update required (Android 9–13), zero steps, populated data from multiple sources, rotation during permission flow, local midnight/time-zone changes, and manual entry after a failed sync. No device tests are implied by a successful APK build. If the activity is recreated while permission UI is open, tap sync again after returning; permissions are rechecked.

References: [Health Connect setup](https://developer.android.com/health-and-fitness/health-connect/get-started), [aggregate data](https://developer.android.com/health-and-fitness/health-connect/aggregate-data), [origin-restricted WebView messages](https://developer.android.com/reference/androidx/webkit/WebViewCompat.WebMessageListener).
