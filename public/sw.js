const CACHE_NAME = "postbox-shell-v1"
const SHELL_FILES = ["/offline.html", "/icon.svg", "/icon-192.png", "/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith("postbox-shell-") && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET" || request.mode !== "navigate") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache authenticated pages, email content, or API responses.
  event.respondWith(fetch(request).catch(async () => {
    const offline = await caches.match("/offline.html")
    return offline || Response.error()
  }))
})
