/* Reise-Englisch PWA Service Worker
   Strategie:
   - App-Shell wird beim Install vorab gecacht (Offline-Start).
   - Navigation/HTML: network-first (Updates kommen sofort an), Cache als Offline-Fallback.
   - Übrige Dateien (Icons, Chart.js-CDN): cache-first mit Nachladen im Hintergrund.
   Bei jedem Release CACHE_VERSION hochzählen (macht alte Caches frei). */
const CACHE_VERSION = "re-pwa-v6";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // Sync-POSTs etc. nie anfassen
  const url = new URL(req.url);
  // GitHub-API (Sync) nie cachen – immer live
  if (url.hostname.endsWith("github.com") || url.hostname.endsWith("githubusercontent.com")) return;

  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    // network-first für die App selbst
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  // cache-first für alles andere (Icons, CDN)
  e.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
