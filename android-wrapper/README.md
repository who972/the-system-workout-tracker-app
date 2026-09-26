# THE SYSTEM Android wrapper

Native Android shell for THE SYSTEM web application.

It provides the `SystemHealthNative` WebView message channel consumed by `health-connect.js`.

## Health Connect
The wrapper requests read-only access to Steps and returns the aggregate for the current local day. The web app does not write Health Connect records.

## Web content
Before building, copy the deployed web application files into `app/src/main/assets/www/`. The Android activity loads `https://appassets.androidplatform.net/assets/www/index.html` through WebViewAssetLoader.

## Build
Use JDK 17 and Android SDK 35, then run `./gradlew assembleDebug` after adding the Gradle wrapper or import `android-wrapper` into Android Studio.
