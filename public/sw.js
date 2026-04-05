const PRECACHE_NAME = "censussync-precache-v4";
const RUNTIME_CACHE_NAME = "censussync-runtime-v4";
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg"
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHtmlRequest(request) {
  return (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  );
}

function isAppStaticAsset(url) {
  return (
    url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/")
  );
}

function isNextStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isCacheableAsset(request, url) {
  return (
    isAppStaticAsset(url) ||
    isNextStaticAsset(url) ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image"
  );
}

function shouldBypassRequest(request, url) {
  return (
    request.method !== "GET" ||
    !isSameOrigin(url) ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/__/")
  );
}

async function putInCache(cacheName, request, response) {
  if (!response || !response.ok) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());

  return response;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) => key !== PRECACHE_NAME && key !== RUNTIME_CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (shouldBypassRequest(event.request, requestUrl)) {
    return;
  }

  if (isHtmlRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) =>
          putInCache(RUNTIME_CACHE_NAME, event.request, response)
        )
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached ?? Response.error();
        })
    );
    return;
  }

  if (!isCacheableAsset(event.request, requestUrl)) {
    return;
  }

  event.respondWith(
    caches.open(PRECACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkRequest = fetch(event.request)
        .then((response) => putInCache(PRECACHE_NAME, event.request, response))
        .catch(() => cached);

      const fresh = await networkRequest;
      return cached ?? fresh ?? Response.error();
    })
  );
});
