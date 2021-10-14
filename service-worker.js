"use strict";

/* A version number is useful when updating the worker logic,
   allowing you to remove outdated cache entries during the update. */
var version = 'v0.0.7.0::';

/* These resources will be downloaded and cached by the service worker
   during the installation process. If any resource fails to be downloaded,
   then the service worker won't be installed either. */
// TODO: Build this automatically by crawling the main files...
var offlineFundamentals = [
  '',
  //'service-worker.js',
  "manifest.webmanifest",
  "icon/android-chrome-192x192.png",
  /*"node_modules/three/build/three.d.ts",
  "node_modules/three/build/three.min.js",
  "node_modules/three/examples/js/controls/DragControls.js",
  "node_modules/three/examples/js/controls/OrbitControls.js",
  "node_modules/three/examples/js/controls/TransformControls.js",
  "node_modules/three/examples/js/exporters/STLExporter.js",
  "node_modules/three/examples/js/exporters/OBJExporter.js",
  "node_modules/tweakpane/dist/tweakpane.js",
  "node_modules/jquery/dist/jquery.min.js",
  "node_modules/opentype.js/dist/opentype.min.js",
  "node_modules/golden-layout/dist/goldenlayout.min.js",
  "node_modules/golden-layout/src/css/goldenlayout-base.css",
  "node_modules/golden-layout/src/css/goldenlayout-dark-theme.css",
  "node_modules/rawflate/rawdeflate.js",
  "node_modules/rawflate/rawinflate.js",
  "node_modules/opencascade.js/dist/opencascade.wasm.js",
  "node_modules/opencascade.js/dist/opencascade.wasm.wasm",
  "node_modules/monaco-editor/min/vs/editor/editor.main.css",
  "node_modules/monaco-editor/min/vs/loader.js",
  "node_modules/monaco-editor/min/vs/editor/editor.main.nls.js",
  "node_modules/monaco-editor/min/vs/editor/editor.main.js",
  "node_modules/monaco-editor/min/vs/basic-languages/javascript/javascript.js",
  "node_modules/monaco-editor/min/vs/basic-languages/typescript/typescript.js",
  "node_modules/monaco-editor/min/vs/language/typescript/tsMode.js",
  "node_modules/monaco-editor/min/vs/language/typescript/tsWorker.js",
  "node_modules/monaco-editor/min/vs/base/worker/workerMain.js",
  "node_modules/monaco-editor/min/vs/base/browser/ui/codiconLabel/codicon/codicon.ttf",
  "node_modules/opencascade.js/dist/oc.d.ts",
  "js/CascadeStudioStandardLibrary.js",
  "js/openCascadeHelper.js",
  "js/CascadeView.js",
  "js/main.js",
  "js/index.ts",
  "fonts/Roboto.ttf",
  "fonts/Consolas.ttf",
  "fonts/Papyrus.ttf",
  "textures/dullFrontLitMetal.png",
  "icon/favicon.ico"*/
];

/* The install event fires when the service worker is first installed.
   You can use this event to prepare the service worker to be able to serve
   files while visitors are offline.*/
self.addEventListener("install", function(event) {
  console.log('Installing Cascade Studio Resources for Offline Retrieval...');
  /* Using event.waitUntil(p) blocks the installation process on the provided
     promise. If the promise is rejected, the service worker won't be installed.*/
  event.waitUntil(
    /* The caches built-in is a promise-based API that helps you cache responses,
       as well as finding and deleting them.*/
    caches
      /* You can open a cache by name, and this method returns a promise. We use
         a versioned cache name here so that we can remove old cache entries in
         one fell swoop later, when phasing out an older service worker.*/
      .open(version + 'fundamentals')
      .then(function(cache) {
        /* After the cache is opened, we can fill it with the offline fundamentals.
           The method below will add all resources in `offlineFundamentals` to the
           cache, after making requests for them.*/
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
    //console.log('Non GET fetch event ignored...', event.request.method, event.request.url);
    //event.respondWith(useNetwork(event.request, failureResponse));
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
        //console.log("Using cache for: " + request.url);
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
        //console.log("Using network for: " + request.url);
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
  
  // Default to Cache, Fallback to Network
  event.respondWith(
    //useCache(event.request, useNetwork)
    useNetwork(event.request, useCache)
  );
});

/* The activate event fires after a service worker has been successfully installed.
   It is most useful when phasing out an older version of a service worker, as at
   this point you know that the new worker was installed correctly. In this example,
   we delete old caches that don't match the version in the worker we just finished
   installing.*/
self.addEventListener("activate", function(event) {
  /* Just like with the install event, event.waitUntil blocks activate on a promise.
     Activation will fail unless the promise is fulfilled.*/
  //console.log('WORKER: activate event in progress.');

  event.waitUntil(
    caches
      /* This method returns a promise which will resolve to an array of available
         cache keys.*/
      .keys()
      .then(function (keys) {
        // We return a promise that settles when all outdated caches are deleted.
        return Promise.all(
          keys
            .filter(function (key) {
              // Filter by keys that don't start with the latest version prefix.
              return !key.startsWith(version);
            })
            .map(function (key) {
              /* Return a promise that's fulfilled
                 when each outdated cache is deleted.*/
              return caches.delete(key);
            })
        );
      })
      .then(function() {
        //console.log('WORKER: activate completed.');
      })
  );
});
