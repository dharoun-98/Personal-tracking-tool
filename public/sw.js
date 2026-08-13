/**
 * Lifequest service worker.
 *
 * Hand-written rather than generated, because the caching rules here are
 * simple and the failure mode of a misconfigured generated worker (serving a
 * stale app shell forever) is genuinely nasty to debug.
 *
 * Strategy:
 *   - navigations      → network only, fall back to /offline
 *   - /_next/static/*  → cache first (content-hashed, immutable)
 *   - images & icons   → stale-while-revalidate
 *   - everything else  → straight to the network
 *
 * Game data is NOT cached here: it lives in localStorage, so an already-open
 * app keeps working offline without the worker knowing anything about it. A
 * cold navigation falls back to the deliberately anonymous offline page.
 *
 * Navigation HTML is private by default. It can contain an email address,
 * account state, billing access, or an admin view, and Cache Storage does not
 * partition entries by the signed-in cookie. Replaying a cached page after a
 * sign-out or account switch would therefore show the previous person's
 * identity. Static assets remain safely cacheable; document responses do not.
 */

const VERSION = "v2";
const SHELL_CACHE = `lifequest-shell-${VERSION}`;
const ASSET_CACHE = `lifequest-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 can't fail the whole install.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("lifequest-") && !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isImage(request, url) {
  return (
    request.destination === "image" ||
    /\.(png|jpg|jpeg|svg|webp|avif|ico)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch cross-origin traffic or Next's dev/HMR endpoints.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (isImage(request, url)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

async function handleNavigation(request) {
  try {
    // Never put document HTML in Cache Storage. Requests include cookies, but
    // cache keys do not safely separate one authenticated identity from the
    // next person using the same browser profile.
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("You're offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

/* -------------------------------------------------------------------- *
 * Push notifications
 *
 * The subscription and sending side arrive in a later stage; the handlers
 * live here now so an installed worker already knows what to do when the
 * server starts sending.
 * -------------------------------------------------------------------- */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Lifequest";
  const options = {
    body: payload.body || "Your companion has something for you.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "lifequest",
    // Replace rather than stack: three identical nudges is nagging.
    renotify: false,
    requireInteraction: false,
    data: { url: payload.url || "/dashboard" },
    actions: payload.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing window if we already have one open.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
