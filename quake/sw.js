const CACHE_NAME = "phippsgate-runtime-v6";

const VIRTUAL_FILES = {
  "assets/lq.bin": {
    type: "application/x-7z-compressed",
    parts: [
      "assets/lq.bin.part00", "assets/lq.bin.part01", "assets/lq.bin.part02",
      "assets/lq.bin.part03", "assets/lq.bin.part04", "assets/lq.bin.part05",
    ],
  },
  "runtime/qwasm-gl.wasm": {
    type: "application/wasm",
    parts: [
      "runtime/qwasm-gl.wasm.part00", "runtime/qwasm-gl.wasm.part01",
      "runtime/qwasm-gl.wasm.part02",
    ],
  },
  "runtime/qwasm-sw.wasm": {
    type: "application/wasm",
    parts: ["runtime/qwasm-sw.wasm.part00", "runtime/qwasm-sw.wasm.part01"],
  },
  "runtime/libarchive.wasm": {
    type: "application/wasm",
    parts: ["runtime/libarchive.wasm.part00", "runtime/libarchive.wasm.part01"],
  },
  "game/pak6.pak": {
    type: "application/octet-stream",
    parts: ["game/pak6.pak.part00?v=9", "game/pak6.pak.part01?v=9", "game/pak6.pak.part02?v=9"],
  },
};

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("phippsgate-runtime-") && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

function relativePath(url) {
  const scope = new URL(self.registration.scope);
  const requestUrl = new URL(url);
  if (requestUrl.origin !== scope.origin || !requestUrl.pathname.startsWith(scope.pathname)) return null;
  return decodeURIComponent(requestUrl.pathname.slice(scope.pathname.length));
}

async function assemble(request, definition) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const buffers = await Promise.all(definition.parts.map(async (part) => {
    const response = await fetch(new URL(part, self.registration.scope), { cache: "force-cache" });
    if (!response.ok) throw new Error(`${part} returned HTTP ${response.status}`);
    return response.arrayBuffer();
  }));
  const size = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const response = new Response(new Blob(buffers, { type: definition.type }), {
    status: 200,
    headers: {
      "Content-Type": definition.type,
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Phippsgate-Assembled": "1",
    },
  });
  await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const path = relativePath(event.request.url);
  const definition = path && VIRTUAL_FILES[path];
  if (!definition) return;
  event.respondWith(assemble(event.request, definition).catch((error) => new Response(`AH HELL: ${error.message}`, {
    status: 502,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })));
});
