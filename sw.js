// Kindred Cards offline cache. The version changes on every build so phones pick up updates.
const CACHE = "kindred-ac3d561c6e";
const CORE = ["./", "./index.html", "./icon.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  // cache: "reload" skips the phone's short-term web cache so a new version never saves an old copy.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(CORE.map(u => fetch(new Request(u, { cache: "reload" })).then(r => { if (r.ok) return c.put(u, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kindred-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise(res => setTimeout(() => res(null), ms)); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    const fresh = fetch(req, isFont ? {} : { cache: "no-cache" }).then(res => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    // The game page itself: try the internet first (up to 3 seconds) so updates show right away,
    // and fall back to the saved copy when offline.
    if (req.mode === "navigate") {
      const res = await Promise.race([fresh, timeout(3000)]);
      if (res && res.ok) return res;
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("./index.html")) || (await fresh) || Response.error();
    }
    // Everything else: saved copy first, refreshed in the background.
    const hit = await cache.match(req, { ignoreSearch: !isFont });
    if (hit) { e.waitUntil(fresh); return hit; }
    return (await fresh) || Response.error();
  }));
});
