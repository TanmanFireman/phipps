# Source and rebuilding

No commercial Quake data is included or downloaded by this project.

## Engine

The WebAssembly engine files were built by the Qwasm project from the GPL Quake source. This distribution uses unmodified Qwasm engine artifacts corresponding to commit:

`f56b5e71e4be8effede29bae1785a5306dcc0249`

Complete machine-readable corresponding source is included locally as the split archive under `engine-source/`. Its README gives the reconstruction command and checksum. The same revision and history are also available upstream:

https://github.com/GMH-Code/Qwasm/tree/f56b5e71e4be8effede29bae1785a5306dcc0249

Original id Software Quake source:

https://github.com/id-Software/Quake

## Open game data

The base game archive is LibreQuake, a BSD-licensed, freely redistributable Quake-compatible data set:

https://github.com/lavenderdotpet/LibreQuake

## Phipps level and pack

`tools/build_game.py` generates `source/phipps1.map`, compiles it, creates an original animated Phipps player model, and writes the custom `pak6.pak`. The player generator is `tools/phipps_model.py`; it emits a classic Quake v6 alias model with all 143 frame slots expected by LibreQuake's open `player.qc`.

The Qwasm binary suppresses its local view entity, so chase-camera mode also
uses a non-solid QuakeC proxy that mirrors the player's origin, yaw, frame, and
effects. The corresponding source is `source/phipps_proxy.qc`; the complete
upstream-relative change is `source/librequake-phipps-proxy.patch`.

`source/progs.dat` was compiled from LibreQuake commit:

`bd59845a38b4434c6a369fedb5db4c4562e70282`

The QuakeC compiler was FTEQCC git build `f937b9d88` (2026-06-04). To reproduce
the gamecode:

```sh
git clone https://github.com/lavenderdotpet/LibreQuake.git
cd LibreQuake
git checkout bd59845a38b4434c6a369fedb5db4c4562e70282
git apply /path/to/phipps/quake/source/librequake-phipps-proxy.patch
mkdir -p lq1
fteqcc qcsrc/progs.src -D__LIBREQUAKE__ -O3
cp lq1/progs.dat /path/to/phipps/quake/source/progs.dat
```

Requirements:

- Python 3 and Pillow
- LibreQuake `pak0.pak` and `pak3.pak`
- the checked-in GPL-licensed `source/progs.dat`
- ericw-tools `qbsp`, `vis`, `light`, and `bsputil`

The pack in this repository was compiled with ericw-tools commit/tag:

`6660c5fc09fe2fbcfd3c40a5839eed7d5a41dc53` (`v0.18.2-rc1`)

Example:

```sh
python quake/tools/build_game.py \
  --pak0 /path/to/pak0.pak \
  --pak3 /path/to/pak3.pak \
  --tools /path/to/ericw-tools/bin
```

When the checked-in BSP and LIT are unchanged, the pack and player model can be
rebuilt without the map compiler:

```sh
python quake/tools/build_game.py --pak0 /path/to/pak0.pak
```

After rebuilding, split binary files into 600,000-byte numbered parts matching the paths declared in `sw.js`.
