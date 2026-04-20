/**
 * Tombstone service worker.
 *
 * The current app does NOT use a service worker. Earlier (legacy JSX) versions
 * registered one at this path, and browsers that visited the old build still
 * have it installed. This file replaces that SW with a no-op that:
 *   1. Deletes every Cache entry left over from the old app.
 *   2. Unregisters itself.
 *   3. Reloads any open tabs so they load fresh resources directly from the
 *      dev server / network (no SW in the middle).
 *
 * Safe to keep long-term — browsers that never had an SW simply ignore it.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (err) {
        // ignore — we still want to unregister
      }

      try {
        await self.registration.unregister();
      } catch (err) {
        // ignore
      }

      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch (err) {
          // client.navigate may fail for cross-origin; ignore
        }
      }
    })()
  );
});

// Explicit pass-through fetch handler so the browser never sees a broken
// cache-only response from a stale SW on the very first activation tick.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
