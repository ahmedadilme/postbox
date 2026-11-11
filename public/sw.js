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
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME)
      const offline = await cache.match("/offline.html")
      if (offline) return offline
      return new Response(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Postbox</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#172033;font:16px system-ui,sans-serif}main{max-width:28rem;padding:2rem;text-align:center}h1{margin:1rem 0 .5rem;font-size:1.4rem}p{color:#64748b;line-height:1.5}</style></head><body><main><h1>You’re offline</h1><p>Reconnect to the internet to open Postbox and sync your mail.</p></main></body></html>',
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    }),
  )
})
