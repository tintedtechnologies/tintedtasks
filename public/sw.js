const CACHE_VERSION = 'v1.0.0'
const STATIC_CACHE = `tinted-tasks-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `tinted-tasks-runtime-${CACHE_VERSION}`
const APP_SHELL = [
  '',
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
]

function getAppBaseUrl() {
  return new URL(self.registration.scope)
}

function toAppUrl(path = '') {
  return new URL(path, getAppBaseUrl()).toString()
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)),
      )

      await self.clients.claim()
      await broadcastCacheStatus()
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request))
    return
  }

  const cacheableDestinations = new Set(['script', 'style', 'image', 'font'])
  if (cacheableDestinations.has(request.destination) || requestUrl.pathname.endsWith('.webmanifest')) {
    event.respondWith(handleAssetRequest(request))
  }
})

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE)
  await cache.addAll(APP_SHELL.map((path) => new Request(toAppUrl(path), { cache: 'reload' })))
}

async function broadcastCacheStatus() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })

  for (const client of clients) {
    client.postMessage({
      type: 'SW_CACHE_STATUS',
      version: CACHE_VERSION,
    })
  }
}

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request)
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
    return response
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match(toAppUrl())) ||
      (await caches.match(toAppUrl('index.html'))) ||
      (await caches.match(toAppUrl('offline.html'))) ||
      Response.error()
    )
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request)

  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      const cache = await caches.open(RUNTIME_CACHE)
      cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (cachedResponse) {
    return cachedResponse
  }

  const networkResponse = await networkResponsePromise
  return networkResponse || Response.error()
}
