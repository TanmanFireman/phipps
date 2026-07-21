# Phipps: The Phippsgate Complex

This directory is a real Quake-engine browser build, not a canvas imitation. It combines:

- the GPL-licensed Qwasm WebAssembly port of the Quake engine;
- LibreQuake's freely redistributable Quake-compatible game data;
- a new compiled BSP map, colored lighting, scripted encounters, and player skin made for Phipps;
- the Phipps project's original browser music and presentation layer.

The shipped level is `source/phipps1.map`. It compiles to a standard version-29 Quake BSP and is loaded from `pak6.pak` after LibreQuake's open packs.

The browser-facing WASM, game archive, and custom PAK are split into sub-700 KB pieces for dependable GitHub delivery. `sw.js` reassembles those files transparently inside the browser. The software-rendered Qwasm build is the compatibility-first default; the WebGL build is retained alongside it.

See [SOURCE.md](SOURCE.md) for exact upstream revisions and build instructions, and `licenses/` for license texts and notices.
