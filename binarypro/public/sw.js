// CrownTree service worker. Required for installation. It does not cache pages or API responses,
// so signed-in member data is never stored on the device by this worker.
self.addEventListener('install', (event) => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
