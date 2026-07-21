#!/usr/bin/env python3
"""Build the Phipps Quake add-on pack from open LibreQuake data.

This tool generates a Quake .map, compiles it with ericw-tools, reskins the
LibreQuake player model, and packages the results as a standard Quake PAK.
It deliberately does not download or depend on id Software's commercial data.
"""

from __future__ import annotations

import argparse
import math
import os
from pathlib import Path
import struct
import subprocess
from typing import Iterable

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source"


def read_pak(path: Path) -> dict[str, bytes]:
    data = path.read_bytes()
    magic, directory_offset, directory_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"PACK" or directory_size % 64:
        raise ValueError(f"{path} is not a Quake PAK")
    files: dict[str, bytes] = {}
    for offset in range(directory_offset, directory_offset + directory_size, 64):
        raw_name, file_offset, file_size = struct.unpack_from("<56sII", data, offset)
        name = raw_name.split(b"\0", 1)[0].decode("ascii")
        files[name] = data[file_offset : file_offset + file_size]
    return files


def write_pak(path: Path, files: dict[str, bytes]) -> None:
    payload = bytearray(b"PACK" + b"\0" * 8)
    positions: list[tuple[str, int, int]] = []
    for name, data in sorted(files.items()):
        if len(name.encode("ascii")) > 55:
            raise ValueError(f"PAK path is too long: {name}")
        positions.append((name, len(payload), len(data)))
        payload.extend(data)
    directory_offset = len(payload)
    for name, file_offset, file_size in positions:
        payload.extend(struct.pack("<56sII", name.encode("ascii"), file_offset, file_size))
    struct.pack_into("<4sII", payload, 0, b"PACK", directory_offset, len(positions) * 64)
    path.write_bytes(payload)


def brush(x1: int, y1: int, z1: int, x2: int, y2: int, z2: int, texture: str) -> str:
    """Return a six-plane axis-aligned Quake brush."""
    return "\n".join(
        [
            "{",
            f"( {x1} {y1} {z1} ) ( {x1} {y2} {z1} ) ( {x1} {y2} {z2} ) {texture} 0 0 0 1 1",
            f"( {x2} {y1} {z1} ) ( {x2} {y1} {z2} ) ( {x2} {y2} {z2} ) {texture} 0 0 0 1 1",
            f"( {x1} {y1} {z1} ) ( {x2} {y1} {z2} ) ( {x2} {y1} {z1} ) {texture} 0 0 0 1 1",
            f"( {x1} {y2} {z1} ) ( {x2} {y2} {z1} ) ( {x2} {y2} {z2} ) {texture} 0 0 0 1 1",
            f"( {x1} {y1} {z1} ) ( {x2} {y1} {z1} ) ( {x1} {y2} {z1} ) {texture} 0 0 0 1 1",
            f"( {x1} {y1} {z2} ) ( {x1} {y2} {z2} ) ( {x2} {y1} {z2} ) {texture} 0 0 0 1 1",
            "}",
        ]
    )


def entity(classname: str, origin: tuple[int, int, int] | None = None, **keys: object) -> str:
    lines = ["{", f'"classname" "{classname}"']
    if origin is not None:
        lines.append(f'"origin" "{origin[0]} {origin[1]} {origin[2]}"')
    for key, value in keys.items():
        lines.append(f'"{key.rstrip("_")}" "{value}"')
    lines.append("}")
    return "\n".join(lines)


def brush_entity(classname: str, brushes: Iterable[str], **keys: object) -> str:
    lines = ["{", f'"classname" "{classname}"']
    for key, value in keys.items():
        lines.append(f'"{key.rstrip("_")}" "{value}"')
    lines.extend(brushes)
    lines.append("}")
    return "\n".join(lines)


def build_map(path: Path) -> None:
    world: list[str] = [
        '"classname" "worldspawn"',
        '"message" "PHIPPS: THE PHIPPSGATE COMPLEX"',
        '"worldtype" "0"',
        '"sounds" "3"',
        '"wad" "efdm1.wad"',
    ]

    # Sealed industrial shell: three arenas, two choke points, one terrible silo.
    world.extend(
        [
            brush(-1056, -544, -32, 1056, 544, 0, "rtex253"),
            brush(-1056, -544, 320, 1056, 544, 352, "sky000"),
            brush(-1056, -544, 0, -1024, 544, 320, "rtex067"),
            brush(1024, -544, 0, 1056, 544, 320, "rtex067"),
            brush(-1024, -544, 0, 1024, -512, 320, "rtex411"),
            brush(-1024, 512, 0, 1024, 544, 320, "rtex411"),
        ]
    )

    # Arena dividers with playable openings.
    for x in (-352, 352):
        world.extend(
            [
                brush(x - 16, -512, 0, x + 16, -104, 224, "metal1_1"),
                brush(x - 16, 104, 0, x + 16, 512, 224, "metal1_1"),
                brush(x - 16, -512, 224, x + 16, 512, 320, "rtex388"),
            ]
        )

    # Pumpkin shipping crates and cover.
    crate_positions = [
        (-760, -330, 96, 96), (-720, 300, 80, 80), (-520, -270, 72, 96),
        (-75, -330, 96, 128), (75, 330, 96, 128), (185, -240, 72, 72),
        (550, -320, 104, 96), (690, 295, 96, 96), (825, -215, 72, 120),
    ]
    for x, y, size, height in crate_positions:
        world.append(brush(x - size // 2, y - size // 2, 0, x + size // 2, y + size // 2, height, "RWood4"))

    # Center silo, hazard pit, and steel walk blocks.
    world.extend(
        [
            brush(-160, -88, 0, 160, -56, 176, "rtex160"),
            brush(-160, 56, 0, 160, 88, 176, "rtex160"),
            brush(-160, -56, 0, -128, 56, 176, "rtex160"),
            brush(128, -56, 0, 160, 56, 176, "rtex160"),
            brush(-128, -56, 0, 128, 56, 8, "rtex259"),
            brush(450, -125, 0, 720, 125, 16, "rtex030"),
            brush(720, -125, 0, 760, 125, 64, "rtex030"),
        ]
    )

    blocks = ["{", *world, "}"]

    # Player, lights, weapons, armor, and supplies.
    blocks.extend(
        [
            entity("info_player_start", (-900, 0, 24), angle="0"),
            entity("weapon_supershotgun", (-690, 0, 24)),
            entity("weapon_nailgun", (-30, 230, 24)),
            entity("weapon_rocketlauncher", (560, 0, 40)),
            entity("item_armor1", (-505, 160, 24)),
            entity("item_armor2", (500, 255, 24)),
            entity("ammo_shells", (-575, -155, 24)),
            entity("ammo_shells", (-95, 235, 24)),
            entity("ammo_nails", (130, -245, 24)),
            entity("ammo_rockets", (770, 170, 24)),
            entity("item_health", (-480, 0, 24)),
            entity("item_health", (245, 225, 24)),
            entity("item_health", (790, -20, 24), spawnflags="2"),
        ]
    )

    # Combat progression. The final Shambler guards the haygate.
    monsters = [
        ("monster_dog", (-660, -170, 24), 45),
        ("monster_dog", (-630, 180, 24), 315),
        ("monster_army", (-470, -235, 24), 90),
        ("monster_knight", (-445, 235, 24), 270),
        ("monster_ogre", (-45, -245, 24), 90),
        ("monster_ogre", (80, 250, 24), 270),
        ("monster_enforcer", (245, -180, 24), 180),
        ("monster_demon1", (500, -225, 24), 90),
        ("monster_demon1", (585, 230, 24), 270),
        ("monster_shambler", (815, 0, 24), 180),
    ]
    for classname, origin, angle in monsters:
        blocks.append(entity(classname, origin, angle=str(angle)))

    # Warm farm lights against cold industrial fill.
    for x in (-850, -610, -190, 190, 520, 830):
        blocks.append(entity("light", (x, -365 if x % 2 else 365, 232), light="420"))
        blocks.append(entity("light", (x, 0, 256), light="300"))
    blocks.extend(
        [
            entity("light", (0, 0, 210), light="650", _color="1 0.32 0.08"),
            entity("light", (690, 0, 140), light="500", _color="0.35 0.55 1"),
        ]
    )

    # Sliding blast doors are genuine Quake brush entities.
    blocks.extend(
        [
            brush_entity(
                "func_door",
                [brush(-368, -104, 0, -336, 104, 208, "rtex082")],
                angle="-1", speed="90", wait="2", lip="8", message="AH HELL. THE HAYGATE'S JAMMED.",
            ),
            brush_entity(
                "func_door",
                [brush(336, -104, 0, 368, 104, 208, "rtex082")],
                angle="-1", speed="70", wait="3", lip="8", message="AH HELL. ROUND TWO.",
            ),
        ]
    )

    # Story beats use stock Quake touch triggers and centerprint messages.
    triggers = [
        (-970, -180, 0, -820, 180, 120, "AH HELL. THE COWS GOT INTO THE COMPLEX."),
        (-430, -150, 0, -370, 150, 150, "I'M LIKE YOU. I ALSO KEEP A SHOTGUN BY THE SEED CATALOG."),
        (-80, -140, 0, 80, 140, 150, "AH HELL. SOMETHING ATE THE PUMPKINS."),
        (370, -150, 0, 430, 150, 150, "I'M LIKE YOU. I ALSO THOUGHT THE SILO WAS EMPTY."),
        (735, -170, 0, 790, 170, 180, "AH HELL. THAT AIN'T A COW."),
    ]
    for index, (x1, y1, z1, x2, y2, z2, message) in enumerate(triggers):
        blocks.append(
            brush_entity(
                "trigger_once",
                [brush(x1, y1, z1, x2, y2, z2, "trigger")],
                message=message,
                target=f"relay_{index}",
            )
        )
        blocks.append(entity("trigger_relay", targetname=f"relay_{index}"))

    # Exit loops the prototype for now, with a final line before the restart.
    blocks.extend(
        [
            brush_entity(
                "trigger_changelevel",
                [brush(940, -120, 0, 1000, 120, 160, "trigger")],
                map="phipps1",
            ),
            brush_entity(
                "trigger_once",
                [brush(885, -140, 0, 930, 140, 170, "trigger")],
                message="I'M LIKE YOU. I ALSO CALL THIS FIXED.",
            ),
        ]
    )

    path.write_text("\n\n".join(blocks) + "\n", encoding="ascii")


def nearest_palette(image: Image.Image, palette_bytes: bytes) -> bytes:
    palette = Image.new("P", (1, 1))
    palette.putpalette(list(palette_bytes))
    return image.convert("RGB").quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG).tobytes()


def reskin_player(model: bytes, palette_bytes: bytes, portrait_path: Path) -> bytes:
    header = struct.unpack_from("<2i3f3ff3f8if", model, 0)
    num_skins, width, height = header[12], header[13], header[14]
    if num_skins != 1 or struct.unpack_from("<i", model, 84)[0] != 0:
        raise ValueError("Expected one ungrouped LibreQuake player skin")

    original = model[88 : 88 + width * height]
    rgb = Image.new("RGB", (width, height))
    rgb.putdata([tuple(palette_bytes[index * 3 : index * 3 + 3]) for index in original])
    pixels = rgb.load()

    # Recolor the armor's warm ramps into work-worn denim while retaining shading.
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            if r > b * 1.18 and g > b * 1.08 and r > 55:
                value = max(r, g, b) / 255
                pixels[x, y] = (int(22 + 35 * value), int(42 + 68 * value), int(58 + 102 * value))

    # Put Phipps himself on the front and back helmet panels. It is intentionally
    # absurd up close, but unmistakably Phipps in chase-cam and multiplayer.
    portrait = Image.open(portrait_path).convert("RGBA")
    source_width, source_height = portrait.size
    portrait = portrait.crop((
        int(source_width * 0.19),
        int(source_height * 0.07),
        int(source_width * 0.57),
        int(source_height * 0.40),
    ))
    face = ImageOps.fit(portrait, (44, 42), method=Image.Resampling.LANCZOS, centering=(0.46, 0.27))
    face = ImageEnhance.Contrast(face).enhance(1.12)
    rgb.paste(face.convert("RGB"), (66, 3), face.getchannel("A"))
    back = ImageOps.mirror(face).resize((38, 38), Image.Resampling.LANCZOS)
    rgb.paste(back.convert("RGB"), (218, 4), back.getchannel("A"))

    indexed = nearest_palette(rgb, palette_bytes)
    return model[:88] + indexed + model[88 + width * height :]


def run_checked(command: list[str], cwd: Path, env: dict[str, str]) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, env=env, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pak0", type=Path, required=True, help="LibreQuake pak0.pak")
    parser.add_argument("--pak3", type=Path, required=True, help="LibreQuake pak3.pak")
    parser.add_argument("--tools", type=Path, required=True, help="Directory containing qbsp/vis/light/bsputil")
    parser.add_argument("--portrait", type=Path, default=ROOT.parent / "assets" / "phipps.png")
    parser.add_argument("--output", type=Path, default=ROOT / "pak6.pak")
    args = parser.parse_args()

    work = ROOT / "build"
    work.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)

    pak0 = read_pak(args.pak0)
    pak3 = read_pak(args.pak3)
    (work / "efdm1.bsp").write_bytes(pak3["maps/efdm1.bsp"])

    env = dict(os.environ)
    env["LD_LIBRARY_PATH"] = str(args.tools) + os.pathsep + env.get("LD_LIBRARY_PATH", "")
    run_checked([str(args.tools / "bsputil"), "--extract-textures", "efdm1.bsp"], work, env)

    map_path = SOURCE / "phipps1.map"
    build_map(map_path)
    (work / "efdm1.wad").replace(SOURCE / "efdm1.wad")
    try:
        run_checked([str(args.tools / "qbsp"), "-wadpath", str(SOURCE), str(map_path)], SOURCE, env)
        run_checked([str(args.tools / "vis"), "-level", "4", str(SOURCE / "phipps1.bsp")], SOURCE, env)
        run_checked([str(args.tools / "light"), "-extra4", "-gate", "0.08", str(SOURCE / "phipps1.bsp")], SOURCE, env)
    finally:
        # The extracted WAD is reproducible LibreQuake input and not part of our source.
        if (SOURCE / "efdm1.wad").exists():
            (SOURCE / "efdm1.wad").replace(work / "efdm1.wad")

    custom_player = reskin_player(pak0["progs/player.mdl"], pak0["gfx/palette.lmp"], args.portrait)
    autoexec = b"hostname PHIPPSGATE\nname PHIPPS\nsensitivity 5\nfov 100\ngamma 0.72\ncrosshair 1\n"
    files = {
        "maps/phipps1.bsp": (SOURCE / "phipps1.bsp").read_bytes(),
        "maps/phipps1.lit": (SOURCE / "phipps1.lit").read_bytes(),
        "progs/player.mdl": custom_player,
        "autoexec.cfg": autoexec,
    }
    write_pak(args.output, files)
    print(f"Built {args.output} ({args.output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
