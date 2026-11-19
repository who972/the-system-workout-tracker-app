# THE SYSTEM — Workout Tracker

Static workout tracker web app. Open `index.html` through a local web server to develop, or deploy the repository root as a static site.

## Local preview

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000` from the project directory. The service worker requires localhost or HTTPS.

## Deployment

For Vercel, import this repository as an **Other** framework project. Leave the build command empty and set the output directory to `.`. No dependencies or build step are required.

## Device data

Android ships the app assets in the APK. Workouts, settings, XP, rank and history are stored on the device. First launch walks through training preferences and offers an optional Entry Test. Health Connect can be enabled separately in Health.

Open Settings → Device Data to export a JSON backup or import one. Import replaces the active device save after confirmation. Existing local progress is retained when upgrading in place with the same Android package and signing key.

- **Reset Progress** clears training history, XP, rank and assessment while keeping preferences and custom workouts.
- **Factory Reset** clears this app’s storage on the device. Export a backup first if you want to keep your progress.

The Android GitHub Actions workflow uses the existing signing key to create an update-compatible APK.

For the web preview, load the app once on localhost or HTTPS to let the service worker cache its assets.
