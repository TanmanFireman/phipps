# Phipps

Three browser FPS adventures about one farmer, several cows, and a very bad night.

## Games

- **Harvest of the Damned** — recover three cows, cleanse the south field, and destroy the Infernal Combine.
- **The Haygate Complex** — a larger Quake-inspired campaign with an interconnected fortress, toxic irrigation canals, a tractor key, power switch, second weapon, three secrets, 22 enemies, and the Gate Warden.
- **The Phippsgate Complex** — an actual Quake-derived browser build: Qwasm's GPL engine, LibreQuake's open data, a new compiled BSP level, colored lighting, stock Quake AI and physics, and a Phipps player reskin.

## Play

- **WASD** — move
- **Mouse / arrow keys** — aim
- **Click / Space** — fire
- **Escape** — pause

Touch controls appear automatically on phones and tablets.

## Campaign controls

- **E** — use doors, switches, and secrets
- **1 / 2** — switch weapons

The first two games are dependency-free Canvas/Web Audio projects. The Phippsgate build is a static WebAssembly game and uses a scoped Service Worker to reassemble its GitHub-friendly asset chunks in the browser. All three can be served from GitHub Pages.

## Source and asset note

The Canvas Haygate game studies Quake's pacing but uses original browser code. The separate `quake/` build uses the GPL Quake-derived Qwasm engine and BSD-licensed LibreQuake data; its exact source revisions, licenses, and rebuild instructions are included under that directory. No commercial Quake map or PAK data is included. Quake is a trademark of its respective owner; this fan project is not affiliated with id Software.

Phipps character image supplied by the project owner. “MEGALOVANIA” was composed by Toby Fox and is not claimed as original to this project.
