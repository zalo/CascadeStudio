"use strict";

/* A version number is useful when updating the worker logic,
   allowing you to remove outdated cache entries during the update. */
var version = 'v0.1.0::';

/* These resources will be downloaded and cached by the service worker
   during the installation process. If any resource fails to be downloaded,
   then the service worker won't be installed either. */
var offlineFundamentals = [
  '',
  "manifest.webmanifest",
  "icon/android-chrome-192x192.png",
  /*
  // Build-mode paths (served from build/ directory):
  "main.js",
  "CascadeStudioMainWorker.js",
  "cascadestudio.wasm",

  // Golden Layout v2
  "lib/golden-layout/golden-layout.js",
  "lib/golden-layout/goldenlayout-base.css",
  "lib/golden-layout/goldenlayout-dark-theme.css",

  // Type definitions for Monaco intellisense
  "typedefs/cascadestudio.d.ts",
  "typedefs/three.d.ts",
  "typedefs/StandardLibraryIntellisense.ts",

  // Monaco Editor (AMD loader)
  "monaco-editor/min/vs/editor/editor.main.css",
  "monaco-editor/min/vs/loader.js",
  "monaco-editor/min/vs/editor/editor.main.nls.js",
  "monaco-editor/min/vs/editor/editor.main.js",
  "monaco-editor/min/vs/basic-languages/javascript/javascript.js",
  "monaco-editor/min/vs/basic-languages/typescript/typescript.js",
  "monaco-editor/min/vs/language/typescript/tsMode.js",
  "monaco-editor/min/vs/language/typescript/tsWorker.js",
  "monaco-editor/min/vs/base/worker/workerMain.js",

  // Assets
  "css/main.css",
  "fonts/Roboto.ttf",
  "fonts/Consolas.ttf",
  "fonts/Papyrus.ttf",
  "textures/dullFrontLitMetal.png",
  "icon/favicon.ico"
  */
];

/* The install event fires when the service worker is first installed.
   You can use this event to prepare the service worker to be able to serve
   files while visitors are offline.*/
self.addEventListener("install", function(event) {
  console.log('Installing Cascade Studio Resources for Offline Retrieval...');
  event.waitUntil(
    caches
      .open(version + 'fundamentals')
      .then(function(cache) {
        return cache.addAll(offlineFundamentals);
      })
      .then(function() {
        console.log('Install Complete!  Cascade Studio is ready to be used offline!');
      })
  );
});

/* The fetch event fires whenever a page controlled by this service worker requests
   a resource. This isn't limited to `fetch` or even XMLHttpRequest. Instead, it
   comprehends even the request for the HTML page on first load, as well as JS and
   CSS resources, fonts, any images, etc.*/
self.addEventListener("fetch", function(event) {
  if (event.request.method !== 'GET') {
    return;
  }

  // Return this if both the cache and network fail
  function failureResponse() {
    console.error(request.url + " not found in Cache!  "+
      "Was it included at the top of service-worker.js ? ");
    return new Response('<h1>Service Unavailable</h1>', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/html'
      })
    });
  }

  // Try to acquire the resource from the cache
  function useCache(request, failureCallback) {
    return caches.match(request, { ignoreSearch: true })
    .then(function (cached) {
      if (cached && !request.url.includes("service-worker.js")) {
        return cached;
      } else {
        return failureCallback(request, failureResponse);
      }
    });
  }

  // Try to acquire the resource from the network
  function useNetwork(request, failureCallback) {
    let cachePolicy = request.url.includes("service-worker.js") ? "no-cache" : "default";
    return fetch(request, { cache: cachePolicy })
      .then(function (response) {
        let cacheCopy = response.clone();
        caches
          .open(version + 'pages')
          .then(function add(cache) {
            return cache.put(request, cacheCopy);
          });
        return response;
      }, function (rejected) {
        return failureCallback(event.request, failureResponse);
      }).catch(function (error) {
        return failureCallback(event.request, failureResponse);
      });
  }

  // Default to Network, Fallback to Cache
  event.respondWith(
    useNetwork(event.request, useCache)
  );
});

/* The activate event fires after a service worker has been successfully installed.
   It is most useful when phasing out an older version of a service worker. */
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return !key.startsWith(version);
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
  );
});
