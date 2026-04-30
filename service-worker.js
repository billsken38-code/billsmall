const CACHE_NAME = "bills-mall-v3";

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
  "./admin.css",
  "./vendor-dashboard.css",
  "./product-admin.css",
  "./product.css",
  "./profile.css",
  "./cart.css",
  "./orders-users.css",
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
  "./manifest.json",
  "./vendor-manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/vendor-192.png",
  "./icons/vendor-512.png"
];

function isCacheableAsset(requestUrl) {
  const { pathname } = requestUrl;

  return (
    pathname.match(/\.(?:css|js|png|jpg|jpeg|webp|gif|svg|ico|json|apk)$/i) ||
    pathname.includes("/images/") ||
    pathname.includes("/icons/")
  );
}

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
      requestUrl.pathname.endsWith("/vendor-dashboard.js") ||
      requestUrl.pathname.endsWith("/admin.js") ||
      requestUrl.pathname.endsWith("/index.html") ||
      requestUrl.pathname === "/" ||
      requestUrl.pathname.endsWith("/service-worker.js")
    );
  const isSameOriginAsset = isSameOrigin && isCacheableAsset(requestUrl);

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

  if (isSameOriginAsset) {
    event.respondWith(
      caches.match(event.request).then(async (cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);

          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return networkResponse;
        } catch {
          return cachedResponse || Response.error();
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
