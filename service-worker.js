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
  // ESM Application files
  "js/MainPage/main.js",
  "js/MainPage/CascadeMain.js",
  "js/MainPage/CascadeView.js",
  "js/MainPage/CascadeViewHandles.js",
  "js/CADWorker/CascadeStudioMainWorker.js",
  "js/CADWorker/CascadeStudioStandardLibrary.js",
  "js/CADWorker/CascadeStudioStandardUtils.js",
  "js/CADWorker/CascadeStudioShapeToMesh.js",
  "js/CADWorker/CascadeStudioFileUtils.js",
  "js/StandardLibraryIntellisense.ts",

  // Golden Layout v2
  "lib/golden-layout/golden-layout.js",
  "lib/golden-layout/goldenlayout-base.css",
  "lib/golden-layout/goldenlayout-dark-theme.css",

  // Three.js ESM
  "node_modules/three/build/three.module.js",
  "node_modules/three/examples/jsm/controls/OrbitControls.js",
  "node_modules/three/examples/jsm/controls/TransformControls.js",
  "node_modules/three/examples/jsm/exporters/STLExporter.js",
  "node_modules/three/examples/jsm/exporters/OBJExporter.js",
  "node_modules/three/examples/jsm/libs/fflate.module.js",
  "node_modules/three/examples/jsm/libs/potpack.module.js",

  // Other ESM dependencies
  "node_modules/tweakpane/dist/tweakpane.js",
  "node_modules/opentype.js/dist/opentype.module.js",
  "node_modules/opencascade.js/dist/cascadestudio.js",
  "node_modules/opencascade.js/dist/cascadestudio.wasm",

  // Type definitions for Monaco intellisense
  "node_modules/opencascade.js/dist/cascadestudio.d.ts",
  "node_modules/@types/three/index.d.ts",

  // Monaco Editor (AMD loader)
  "node_modules/monaco-editor/min/vs/editor/editor.main.css",
  "node_modules/monaco-editor/min/vs/loader.js",
  "node_modules/monaco-editor/min/vs/editor/editor.main.nls.js",
  "node_modules/monaco-editor/min/vs/editor/editor.main.js",
  "node_modules/monaco-editor/min/vs/basic-languages/javascript/javascript.js",
  "node_modules/monaco-editor/min/vs/basic-languages/typescript/typescript.js",
  "node_modules/monaco-editor/min/vs/language/typescript/tsMode.js",
  "node_modules/monaco-editor/min/vs/language/typescript/tsWorker.js",
  "node_modules/monaco-editor/min/vs/base/worker/workerMain.js",

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
