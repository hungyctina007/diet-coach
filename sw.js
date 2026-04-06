// ── Service Worker — 我的 AI 減脂教練 ──────────────────────────────────────────
// Cache-first strategy: shell files served from cache; API calls pass through.

const CACHE_NAME = "diet-coach-v1";

// Core files to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json"
];

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      // Activate immediately without waiting for old SW to be discarded
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── Fetch: cache-first for same-origin; network-only for external APIs ────────
self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  // Always go to network for:
  //   • Gemini API calls (generativelanguage.googleapis.com)
  //   • Google Fonts
  //   • CDN scripts (cdnjs)
  //   • Any non-GET request
  var isExternal = url.origin !== self.location.origin;
  var isNonGet   = event.request.method !== "GET";

  if (isExternal || isNonGet) {
    // Pass-through — do not intercept
    return;
  }

  // For same-origin GET requests: cache-first, falling back to network
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        return cached;
      }
      // Not in cache — fetch from network and store a copy
      return fetch(event.request).then(function (response) {
        // Only cache valid, non-opaque responses
        if (
          !response ||
          response.status !== 200 ||
          response.type !== "basic"
        ) {
          return response;
        }
        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(function () {
        // If network fails and cache misses, return the offline shell
        return caches.match("/index.html");
      });
    })
  );
});
