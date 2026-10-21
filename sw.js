// Kindred Cards offline cache. The version changes on every build so phones pick up updates.
const CACHE = "kindred-58716a6a59";
const CORE = ["./", "./index.html", "./icon.png", "./icon-512.png", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("kindred-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;
  // Serve from the phone first so it opens with no internet; refresh the copy in the background.
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: !isFont });
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(fresh); return hit; }
    const res = await fresh;
    if (res) return res;
    if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
    return Response.error();
  }));
});
