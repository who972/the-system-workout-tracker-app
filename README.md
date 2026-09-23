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
