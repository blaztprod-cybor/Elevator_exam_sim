const CACHE_VERSION = "elevator-exam-pwa-v11";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./start.html",
  "./install.html",
  "./exam.html",
  "./review.html",
  "./results.html",
  "./viewer.html",
  "./app.css?v=20260519-full-pdf-scroll",
  "./config.js?v=20260515-render-deploy",
  "./app.js?v=20260519-full-pdf-scroll",
  "./pwa-register.js?v=20260519-install-page2",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
  "./question-bank-1000.csv",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("elevator-exam-pwa-") && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isSameOriginGet(request) {
  return request.method === "GET" && new URL(request.url).origin === self.location.origin;
}

function isShellRequest(request) {
  const url = new URL(request.url);
  return request.mode === "navigate" || APP_SHELL_URLS.some((assetUrl) => new URL(assetUrl, self.location.href).pathname === url.pathname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request, { ignoreSearch: true }) || caches.match("./start.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  const networkResponse = await network;
  return cached || networkResponse || caches.match("./start.html");
}

self.addEventListener("fetch", (event) => {
  if (!isSameOriginGet(event.request)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isShellRequest(event.request)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
