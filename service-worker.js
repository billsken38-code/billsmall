const CACHE_NAME = "bills-mall-v2";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./signup.html",
  "./cart.html",
  "./checkout.html",
  "./product.html",
  "./vendor-dashboard.html",
  "./admin.html",
  "./style.css",
  "./script.js",
  "./auth.js",
  "./cart.js",
  "./checkout.js",
  "./product.js",
  "./vendor-dashboard.js",
  "./admin.js",
  "./admin-auth.js",
  "./firebase.js",
  "./ui.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isHtmlRequest =
    event.request.mode === "navigate" ||
    event.request.destination === "document";
  const isCoreAsset =
    isSameOrigin &&
    (
      requestUrl.pathname.endsWith("/script.js") ||
      requestUrl.pathname.endsWith("/product.js") ||
      requestUrl.pathname.endsWith("/cart.js") ||
      requestUrl.pathname.endsWith("/profile.js") ||
      requestUrl.pathname.endsWith("/checkout.js") ||
      requestUrl.pathname.endsWith("/index.html") ||
      requestUrl.pathname === "/" ||
      requestUrl.pathname.endsWith("/service-worker.js")
    );

  if (isHtmlRequest || isCoreAsset) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || caches.match("./index.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => caches.match("./index.html"))
      );
    })
  );
});
