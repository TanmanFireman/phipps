# Phipps: The Phippsgate Complex

This directory is a real Quake-engine browser build, not a canvas imitation. It combines:

- the GPL-licensed Qwasm WebAssembly port of the Quake engine;
- LibreQuake's freely redistributable Quake-compatible game data;
- a new compiled BSP map, colored lighting, scripted encounters, an original 143-frame low-poly Phipps player model, a QuakeC third-person rendering proxy, and original low-poly pumpkin demons with generated growls driven by the stock monster AI;
- the Phipps project's original browser music and presentation layer.

The shipped level is `source/phipps1.map`. It compiles to a standard version-29 Quake BSP and is loaded from `pak6.pak` after LibreQuake's open packs. The game uses Quake's chase camera plus a non-solid animated QuakeC proxy for an over-the-shoulder third-person view.

The browser-facing WASM, game archive, and custom PAK are split into sub-700 KB pieces for dependable GitHub delivery. `sw.js` reassembles those files transparently inside the browser. The software-rendered Qwasm build is the compatibility-first default; the WebGL build is retained alongside it.

See [SOURCE.md](SOURCE.md) for exact upstream revisions and build instructions, and `licenses/` for license texts and notices.
