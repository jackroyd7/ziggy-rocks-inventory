// Service worker: keeps a copy of the app on the device so it opens without signal.
// - The page, script, styles and icons: network first (so updates arrive at once), saved copy when offline.
// - Photos never change once uploaded: saved copy first, so they show offline.
// - Everything else under /api/ always goes to the network; the app keeps its own copy of the data.
const CACHE = "ziggy-rocks-v1";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch("/", { cache: "no-store" });
      if (res.ok) {
        const html = await res.clone().text();
        await cache.put("/", res);
        const assets = [...html.matchAll(/(?:href|src)="(\/[^"#]+)"/g)].map(m => m[1]).filter(u => !u.startsWith("/api/"));
        await Promise.all(assets.map(u => cache.add(u).catch(() => {})));
      }
    } catch { /* offline during install: the copy fills in on the next visit */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const key = request.mode === "navigate" ? "/" : request;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.hostname.endsWith(".blob.vercel-storage.com")) { event.respondWith(cacheFirst(request)); return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/photo") event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
