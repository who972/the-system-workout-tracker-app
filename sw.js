const CACHE = "the-system-os-v92-device-only";
const ASSETS = ["./","./index.html","./styles.css?v=entry-fit4","./side-system.css?v=assessment-timers15","./manifest.webmanifest","./icon.svg","./enter_the_system_landscape.jpg?v=86","./diagnostics.js?v=72","./account-data.js?v=70","./sleep-tracker.js?v=87","./health-insights.js?v=87","./app.js?v=92","./health-connect.js?v=37","./side-system.js?v=92","./movement-progressions.js?v=91","./workout-help.js?v=91","./system-assistant.js?v=92","./adaptive-training.js?v=88","./competitive-credits.js?v=70","./workout-flow.js?v=90"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});


