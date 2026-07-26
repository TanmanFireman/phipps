#!/usr/bin/env python3
"""Generate an original animated Quake MDL player for Phippsgate.

The model is deliberately authored from simple low-poly primitives so the
complete source stays in the repository.  It follows the 143-frame animation
layout used by LibreQuake's player QuakeC and bakes every pose into classic
Quake vertex animation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import math
from pathlib import Path
import struct
from typing import Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageOps


Vec3 = tuple[float, float, float]
Mat3 = tuple[Vec3, Vec3, Vec3]

SKIN_WIDTH = 128
SKIN_HEIGHT = 128

# Quake's player.qc frame order.  The names are useful to model viewers even
# though the game addresses the frames by their numeric positions.
FRAME_NAMES = (
    [f"axrun{i}" for i in range(1, 7)]
    + [f"rockrun{i}" for i in range(1, 7)]
    + [f"stand{i}" for i in range(1, 6)]
    + [f"axstnd{i}" for i in range(1, 13)]
    + [f"axpain{i}" for i in range(1, 7)]
    + [f"pain{i}" for i in range(1, 7)]
    + [f"axdeth{i}" for i in range(1, 10)]
    + [f"deatha{i}" for i in range(1, 12)]
    + [f"deathb{i}" for i in range(1, 10)]
    + [f"deathc{i}" for i in range(1, 16)]
    + [f"deathd{i}" for i in range(1, 10)]
    + [f"deathe{i}" for i in range(1, 10)]
    + [f"nailatt{i}" for i in range(1, 3)]
    + [f"light{i}" for i in range(1, 3)]
    + [f"rockatt{i}" for i in range(1, 7)]
    + [f"shotatt{i}" for i in range(1, 7)]
    + [f"axatt{i}" for i in range(1, 7)]
    + [f"axattb{i}" for i in range(1, 7)]
    + [f"axattc{i}" for i in range(1, 7)]
    + [f"axattd{i}" for i in range(1, 7)]
)

# Six directional entries from Quake's 162-entry alias normal table.  Broad,
# deliberate facets suit the 1996 silhouette and keep the generator compact.
ALIAS_NORMALS: tuple[tuple[int, Vec3], ...] = (
    (52, (1.0, 0.0, 0.0)),
    (143, (-1.0, 0.0, 0.0)),
    (32, (0.0, 1.0, 0.0)),
    (104, (0.0, -1.0, 0.0)),
    (5, (0.0, 0.0, 1.0)),
    (84, (0.0, 0.0, -1.0)),
)

SWATCHES = {
    "skin": (76, 8),
    "skin_dark": (88, 8),
    "denim": (100, 8),
    "denim_dark": (112, 8),
    "boot": (76, 20),
    "leather": (88, 20),
    "mustache": (100, 20),
    "metal": (112, 20),
    "metal_dark": (76, 32),
    "eye": (88, 32),
    "patch": (100, 32),
    "blood": (112, 32),
}


def add(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a: Vec3, scalar: float) -> Vec3:
    return (a[0] * scalar, a[1] * scalar, a[2] * scalar)


def dot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a: Vec3, b: Vec3) -> Vec3:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def length(a: Vec3) -> float:
    return math.sqrt(dot(a, a))


def normalize(a: Vec3) -> Vec3:
    magnitude = length(a)
    if magnitude < 1e-8:
        return (1.0, 0.0, 0.0)
    return mul(a, 1.0 / magnitude)


def identity() -> Mat3:
    return ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def mat_vec(matrix: Mat3, vector: Vec3) -> Vec3:
    # Matrices are stored as columns so the three tuples are local axes.
    return add(add(mul(matrix[0], vector[0]), mul(matrix[1], vector[1])), mul(matrix[2], vector[2]))


def mat_mul(a: Mat3, b: Mat3) -> Mat3:
    return (mat_vec(a, b[0]), mat_vec(a, b[1]), mat_vec(a, b[2]))


def rotation_x(angle: float) -> Mat3:
    cosine, sine = math.cos(angle), math.sin(angle)
    return ((1.0, 0.0, 0.0), (0.0, cosine, sine), (0.0, -sine, cosine))


def rotation_y(angle: float) -> Mat3:
    cosine, sine = math.cos(angle), math.sin(angle)
    return ((cosine, 0.0, -sine), (0.0, 1.0, 0.0), (sine, 0.0, cosine))


def rotation_z(angle: float) -> Mat3:
    cosine, sine = math.cos(angle), math.sin(angle)
    return ((cosine, sine, 0.0), (-sine, cosine, 0.0), (0.0, 0.0, 1.0))


def transform(point: Vec3, axes: Mat3, center: Vec3) -> Vec3:
    return add(center, mat_vec(axes, point))


def axes_from_forward(forward: Vec3, up_hint: Vec3 = (0.0, 0.0, 1.0)) -> Mat3:
    x_axis = normalize(forward)
    if abs(dot(x_axis, normalize(up_hint))) > 0.96:
        up_hint = (0.0, 1.0, 0.0)
    y_axis = normalize(cross(up_hint, x_axis))
    z_axis = normalize(cross(x_axis, y_axis))
    return (x_axis, y_axis, z_axis)


@dataclass
class Mesh:
    positions: list[Vec3] = field(default_factory=list)
    normals: list[Vec3] = field(default_factory=list)
    texcoords: list[tuple[int, int]] = field(default_factory=list)
    triangles: list[tuple[int, int, int]] = field(default_factory=list)

    def vertex(self, position: Vec3, normal: Vec3, texcoord: tuple[int, int]) -> int:
        self.positions.append(position)
        self.normals.append(normalize(normal))
        self.texcoords.append(texcoord)
        return len(self.positions) - 1


def swatch(name: str) -> tuple[int, int]:
    return SWATCHES[name]


def add_box(
    mesh: Mesh,
    center: Vec3,
    size: Vec3,
    color: str,
    axes: Mat3 = identity(),
) -> None:
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    faces = (
        (((hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)), (1.0, 0.0, 0.0)),
        (((-hx, hy, -hz), (-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz)), (-1.0, 0.0, 0.0)),
        (((-hx, hy, -hz), (hx, hy, -hz), (hx, hy, hz), (-hx, hy, hz)), (0.0, 1.0, 0.0)),
        (((hx, -hy, -hz), (-hx, -hy, -hz), (-hx, -hy, hz), (hx, -hy, hz)), (0.0, -1.0, 0.0)),
        (((-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)), (0.0, 0.0, 1.0)),
        (((-hx, hy, -hz), (hx, hy, -hz), (hx, -hy, -hz), (-hx, -hy, -hz)), (0.0, 0.0, -1.0)),
    )
    uv = swatch(color)
    for corners, local_normal in faces:
        indices = [
            mesh.vertex(transform(corner, axes, center), mat_vec(axes, local_normal), uv)
            for corner in corners
        ]
        mesh.triangles.extend(((indices[0], indices[1], indices[2]), (indices[0], indices[2], indices[3])))


def add_prism(
    mesh: Mesh,
    start: Vec3,
    end: Vec3,
    radius_start: float,
    radius_end: float,
    color: str,
    sides: int = 6,
) -> None:
    axis = normalize(sub(end, start))
    reference = (0.0, 0.0, 1.0) if abs(axis[2]) < 0.9 else (0.0, 1.0, 0.0)
    u_axis = normalize(cross(axis, reference))
    v_axis = normalize(cross(axis, u_axis))
    uv = swatch(color)
    first_ring: list[int] = []
    second_ring: list[int] = []
    for index in range(sides):
        angle = 2 * math.pi * index / sides
        radial = add(mul(u_axis, math.cos(angle)), mul(v_axis, math.sin(angle)))
        first_ring.append(mesh.vertex(add(start, mul(radial, radius_start)), radial, uv))
        second_ring.append(mesh.vertex(add(end, mul(radial, radius_end)), radial, uv))
    start_center = mesh.vertex(start, mul(axis, -1), uv)
    end_center = mesh.vertex(end, axis, uv)
    for index in range(sides):
        nxt = (index + 1) % sides
        mesh.triangles.extend(
            (
                (first_ring[index], first_ring[nxt], second_ring[nxt]),
                (first_ring[index], second_ring[nxt], second_ring[index]),
                (start_center, first_ring[nxt], first_ring[index]),
                (end_center, second_ring[index], second_ring[nxt]),
            )
        )


def add_ellipsoid(
    mesh: Mesh,
    center: Vec3,
    radii: Vec3,
    color: str,
    axes: Mat3 = identity(),
    sides: int = 8,
    rings: int = 4,
) -> None:
    uv = swatch(color)
    rows: list[list[int]] = []
    for ring in range(1, rings + 1):
        latitude = -math.pi / 2 + math.pi * ring / (rings + 1)
        row: list[int] = []
        for side in range(sides):
            longitude = 2 * math.pi * side / sides
            local_normal = (
                math.cos(latitude) * math.cos(longitude),
                math.cos(latitude) * math.sin(longitude),
                math.sin(latitude),
            )
            local_position = (
                radii[0] * local_normal[0],
                radii[1] * local_normal[1],
                radii[2] * local_normal[2],
            )
            row.append(mesh.vertex(transform(local_position, axes, center), mat_vec(axes, local_normal), uv))
        rows.append(row)
    bottom = mesh.vertex(transform((0.0, 0.0, -radii[2]), axes, center), mat_vec(axes, (0.0, 0.0, -1.0)), uv)
    top = mesh.vertex(transform((0.0, 0.0, radii[2]), axes, center), mat_vec(axes, (0.0, 0.0, 1.0)), uv)
    for side in range(sides):
        nxt = (side + 1) % sides
        mesh.triangles.append((bottom, rows[0][nxt], rows[0][side]))
        for ring in range(len(rows) - 1):
            mesh.triangles.extend(
                (
                    (rows[ring][side], rows[ring][nxt], rows[ring + 1][nxt]),
                    (rows[ring][side], rows[ring + 1][nxt], rows[ring + 1][side]),
                )
            )
        mesh.triangles.append((rows[-1][side], rows[-1][nxt], top))


def add_portrait_head(mesh: Mesh, center: Vec3, axes: Mat3) -> None:
    """Add a low-poly head with a photograph wrapped around the front."""
    sides = 10
    rings = 5
    radii = (4.4, 4.25, 5.4)
    for ring in range(rings):
        latitude_a = -math.pi / 2 + math.pi * ring / rings
        latitude_b = -math.pi / 2 + math.pi * (ring + 1) / rings
        for side in range(sides):
            longitude_a = -math.pi + 2 * math.pi * side / sides
            longitude_b = -math.pi + 2 * math.pi * (side + 1) / sides
            corners = (
                (latitude_a, longitude_a),
                (latitude_a, longitude_b),
                (latitude_b, longitude_b),
                (latitude_b, longitude_a),
            )
            indices: list[int] = []
            for latitude, longitude in corners:
                normal = (
                    math.cos(latitude) * math.cos(longitude),
                    math.cos(latitude) * math.sin(longitude),
                    math.sin(latitude),
                )
                position = (radii[0] * normal[0], radii[1] * normal[1], radii[2] * normal[2])
                texture_s = round((longitude + math.pi) / (2 * math.pi) * 63)
                texture_t = round((math.pi / 2 - latitude) / math.pi * 63)
                indices.append(
                    mesh.vertex(
                        transform(position, axes, center),
                        mat_vec(axes, normal),
                        (texture_s, texture_t),
                    )
                )
            mesh.triangles.extend(((indices[0], indices[1], indices[2]), (indices[0], indices[2], indices[3])))


@dataclass
class Pose:
    joints: dict[str, Vec3]
    body_axes: Mat3
    gun_start: Vec3
    gun_end: Vec3
    tool_start: Vec3
    tool_end: Vec3
    gun_scale: float
    tool_scale: float


def _frame_range(index: int) -> tuple[str, int, int]:
    ranges = (
        ("axe_run", 0, 5),
        ("gun_run", 6, 11),
        ("gun_stand", 12, 16),
        ("axe_stand", 17, 28),
        ("axe_pain", 29, 34),
        ("gun_pain", 35, 40),
        ("axe_death", 41, 49),
        ("death_a", 50, 60),
        ("death_b", 61, 69),
        ("death_c", 70, 84),
        ("death_d", 85, 93),
        ("death_e", 94, 102),
        ("nail_attack", 103, 104),
        ("light_attack", 105, 106),
        ("rocket_attack", 107, 112),
        ("shot_attack", 113, 118),
        ("axe_attack_a", 119, 124),
        ("axe_attack_b", 125, 130),
        ("axe_attack_c", 131, 136),
        ("axe_attack_d", 137, 142),
    )
    for name, start, end in ranges:
        if start <= index <= end:
            return name, start, end
    raise ValueError(f"Unknown player frame {index}")


def make_pose(index: int) -> Pose:
    activity, start, end = _frame_range(index)
    span = max(1, end - start)
    progress = (index - start) / span
    cycle = 2 * math.pi * (index - start) / (span + 1)
    root_bounce = 0.0
    root_axes = identity()

    pelvis = (0.0, 0.0, -1.0)
    chest = (0.0, 0.0, 10.5)
    head = (0.0, 0.0, 25.0)
    left_hip = (0.0, 5.2, -1.0)
    right_hip = (0.0, -5.2, -1.0)
    left_knee = (0.5, 5.0, -10.5)
    right_knee = (-0.5, -5.0, -10.5)
    left_ankle = (0.0, 4.8, -20.0)
    right_ankle = (0.0, -4.8, -20.0)
    left_foot = (3.0, 4.8, -22.0)
    right_foot = (3.0, -4.8, -22.0)

    left_shoulder = (0.0, 10.4, 15.5)
    right_shoulder = (0.0, -10.4, 15.5)
    left_elbow = (7.0, 10.7, 8.5)
    right_elbow = (6.0, -8.8, 8.5)
    left_wrist = (15.5, 3.4, 11.5)
    right_wrist = (11.2, -3.2, 12.0)

    gun_scale = 1.0
    tool_scale = 0.025
    gun_start = (6.5, 0.0, 11.8)
    gun_end = (34.0, 0.0, 11.8)
    tool_start = (10.0, -3.0, 9.0)
    tool_end = (21.0, 3.0, 24.0)

    if activity in ("axe_run", "gun_run"):
        stride = math.sin(cycle)
        root_bounce = abs(math.cos(cycle)) * 1.0
        left_knee = (4.5 * stride, 5.0, -10.0)
        right_knee = (-4.5 * stride, -5.0, -10.0)
        left_ankle = (8.5 * stride, 4.8, -19.5 + 1.4 * max(0.0, -stride))
        right_ankle = (-8.5 * stride, -4.8, -19.5 + 1.4 * max(0.0, stride))
        left_foot = add(left_ankle, (3.5, 0.0, -2.0))
        right_foot = add(right_ankle, (3.5, 0.0, -2.0))
        root_axes = mat_mul(rotation_z(0.04 * stride), rotation_y(-0.06))

    if activity.startswith("axe_"):
        gun_scale = 0.025
        tool_scale = 1.0
        left_wrist = (11.0, 3.0, 12.0)
        right_wrist = (7.5, -3.0, 13.5)
        left_elbow = (4.0, 9.0, 10.0)
        right_elbow = (2.5, -9.0, 11.0)

    if activity in ("axe_pain", "gun_pain"):
        pain = math.sin(math.pi * progress)
        root_axes = mat_mul(rotation_y(-0.22 * pain), rotation_z(0.12 * pain))
        chest = (-1.5 * pain, 0.0, 10.5)
        head = (-2.4 * pain, 0.0, 24.5)
        left_elbow = add(left_elbow, (-3.0 * pain, 1.0 * pain, 2.0 * pain))
        right_elbow = add(right_elbow, (-3.0 * pain, -1.0 * pain, 2.0 * pain))

    if activity.endswith("attack") or "_attack" in activity:
        attack = math.sin(math.pi * progress)
        if activity.startswith(("nail", "light", "rocket", "shot")):
            recoil = 2.8 * attack
            gun_start = add(gun_start, (-recoil, 0.0, 0.7 * attack))
            gun_end = add(gun_end, (-recoil, 0.0, 0.7 * attack))
            left_wrist = add(left_wrist, (-recoil, 0.0, 0.7 * attack))
            right_wrist = add(right_wrist, (-recoil, 0.0, 0.7 * attack))
            chest = add(chest, (-0.8 * attack, 0.0, 0.0))
        else:
            # Four deliberately different farm-tool swings share the same six
            # Quake frame slots as the original axe attacks.
            variant = ord(activity[-1]) - ord("a")
            sweep = (-1.15 + progress * 2.25) * (-1 if variant in (1, 3) else 1)
            elevation = 0.55 + 0.65 * math.cos(progress * math.pi)
            if variant == 2:
                elevation += 0.45
            direction = normalize((math.cos(sweep), 0.36 * math.sin(sweep), math.sin(elevation)))
            tool_start = (7.0, -2.5, 13.0)
            tool_end = add(tool_start, mul(direction, 23.0))
            right_wrist = add(tool_start, mul(direction, 2.5))
            left_wrist = add(tool_start, mul(direction, 8.0))
            right_elbow = (2.5, -8.0, 14.0 + 3.0 * attack)
            left_elbow = (4.0, 8.0, 12.5 + 4.0 * attack)

    if "stand" in activity:
        breath = math.sin(cycle) * 0.35
        chest = add(chest, (0.0, 0.0, breath))
        head = add(head, (0.0, 0.0, breath * 0.65))

    death_activities = ("axe_death", "death_a", "death_b", "death_c", "death_d", "death_e")
    if activity in death_activities:
        variant = death_activities.index(activity)
        eased = progress * progress * (3.0 - 2.0 * progress)
        if variant in (0, 3):
            fall = rotation_y((1.42 if variant == 0 else -1.36) * eased)
        elif variant in (1, 4):
            fall = rotation_x((1.42 if variant == 1 else -1.42) * eased)
        else:
            fall = mat_mul(rotation_x((0.92 if variant == 2 else -0.94) * eased), rotation_y(0.88 * eased))
        root_axes = fall
        pivot = (0.0, 0.0, -21.5)
        root_bounce = -1.0 * eased
        gun_scale = 1.0 if activity != "axe_death" else 0.025
        tool_scale = 1.0 if activity == "axe_death" else 0.025
    else:
        pivot = pelvis

    base_joints = {
        "pelvis": pelvis,
        "chest": chest,
        "head": head,
        "left_hip": left_hip,
        "right_hip": right_hip,
        "left_knee": left_knee,
        "right_knee": right_knee,
        "left_ankle": left_ankle,
        "right_ankle": right_ankle,
        "left_foot": left_foot,
        "right_foot": right_foot,
        "left_shoulder": left_shoulder,
        "right_shoulder": right_shoulder,
        "left_elbow": left_elbow,
        "right_elbow": right_elbow,
        "left_wrist": left_wrist,
        "right_wrist": right_wrist,
    }

    def root_transform(point: Vec3) -> Vec3:
        rotated = add(pivot, mat_vec(root_axes, sub(point, pivot)))
        return add(rotated, (0.0, 0.0, root_bounce))

    joints = {name: root_transform(point) for name, point in base_joints.items()}
    gun_start = root_transform(gun_start)
    gun_end = root_transform(gun_end)
    tool_start = root_transform(tool_start)
    tool_end = root_transform(tool_end)
    return Pose(joints, root_axes, gun_start, gun_end, tool_start, tool_end, gun_scale, tool_scale)


def build_frame(index: int) -> Mesh:
    pose = make_pose(index)
    joints = pose.joints
    axes = pose.body_axes
    mesh = Mesh()

    # Denim-covered lower body and broad, bare-armed farmer torso.
    add_ellipsoid(mesh, joints["pelvis"], (8.0, 8.8, 6.0), "denim", axes)
    torso_center = add(joints["chest"], mat_vec(axes, (0.0, 0.0, -0.5)))
    add_ellipsoid(mesh, torso_center, (7.2, 10.2, 9.6), "skin", axes, sides=10)
    add_box(mesh, add(joints["chest"], mat_vec(axes, (6.3, 0.0, -1.2))), (1.7, 13.2, 14.5), "denim", axes)
    add_box(mesh, add(joints["chest"], mat_vec(axes, (7.2, 0.0, -1.0))), (0.6, 7.8, 4.6), "denim_dark", axes)
    add_box(mesh, add(joints["chest"], mat_vec(axes, (7.55, -3.0, -0.8))), (0.35, 2.0, 1.8), "patch", axes)

    # Suspender straps and brass fasteners stay legible at chase-camera range.
    for side in (-1.0, 1.0):
        lower = add(joints["chest"], mat_vec(axes, (7.0, side * 4.9, 5.0)))
        upper = add(joints["chest"], mat_vec(axes, (2.2, side * 8.1, 8.5)))
        add_prism(mesh, lower, upper, 0.95, 0.95, "denim_dark", sides=4)
        add_ellipsoid(mesh, lower, (0.55, 0.55, 0.55), "patch", axes, sides=6, rings=2)

    # Head, neck, ears, nose, eyes, and the unmistakable horseshoe mustache.
    neck_start = add(joints["chest"], mat_vec(axes, (0.0, 0.0, 7.0)))
    neck_end = add(joints["head"], mat_vec(axes, (0.0, 0.0, -4.3)))
    add_prism(mesh, neck_start, neck_end, 3.1, 3.3, "skin_dark", sides=7)
    add_portrait_head(mesh, joints["head"], axes)
    for side in (-1.0, 1.0):
        ear_center = add(joints["head"], mat_vec(axes, (0.0, side * 4.35, 0.1)))
        add_ellipsoid(mesh, ear_center, (1.0, 0.65, 1.7), "skin_dark", axes, sides=6, rings=2)
        eye_center = add(joints["head"], mat_vec(axes, (4.12, side * 1.45, 0.85)))
        add_box(mesh, eye_center, (0.35, 0.85, 0.55), "eye", axes)
    nose = add(joints["head"], mat_vec(axes, (4.75, 0.0, -0.15)))
    add_ellipsoid(mesh, nose, (1.15, 0.95, 1.35), "skin_dark", axes, sides=6, rings=2)
    for side in (-1.0, 1.0):
        inner = add(joints["head"], mat_vec(axes, (4.55, side * 0.35, -1.35)))
        outer = add(joints["head"], mat_vec(axes, (4.20, side * 2.45, -2.65)))
        add_prism(mesh, inner, outer, 0.9, 0.55, "mustache", sides=4)

    # Arms are intentionally thick and angular; this silhouette reads as Phipps
    # even after the Quake renderer downsamples him to a few dozen pixels.
    for side in ("left", "right"):
        shoulder = joints[f"{side}_shoulder"]
        elbow = joints[f"{side}_elbow"]
        wrist = joints[f"{side}_wrist"]
        add_prism(mesh, shoulder, elbow, 3.4, 2.8, "skin", sides=7)
        add_prism(mesh, elbow, wrist, 2.65, 2.1, "skin_dark", sides=7)
        add_ellipsoid(mesh, wrist, (2.35, 2.15, 2.25), "skin", axes, sides=7, rings=3)

    # Thick denim legs and mud-darkened work boots.
    for side in ("left", "right"):
        hip = joints[f"{side}_hip"]
        knee = joints[f"{side}_knee"]
        ankle = joints[f"{side}_ankle"]
        foot = joints[f"{side}_foot"]
        add_prism(mesh, hip, knee, 4.6, 3.8, "denim", sides=7)
        add_prism(mesh, knee, ankle, 3.75, 3.2, "denim_dark", sides=7)
        foot_axes = axes_from_forward(sub(foot, ankle), mat_vec(axes, (0.0, 0.0, 1.0)))
        add_box(mesh, add(mul(add(ankle, foot), 0.5), (0.0, 0.0, -0.7)), (8.0, 5.6, 4.8), "boot", foot_axes)

    # Double-barrel shotgun.  It collapses harmlessly into his hand during the
    # axe frames while the farm tool expands, preserving one fixed topology.
    gun_direction = normalize(sub(pose.gun_end, pose.gun_start))
    gun_axes = axes_from_forward(gun_direction, mat_vec(axes, (0.0, 0.0, 1.0)))
    gun_scale = pose.gun_scale
    gun_mid = mul(add(pose.gun_start, pose.gun_end), 0.5)
    add_box(mesh, add(pose.gun_start, mul(gun_direction, 4.0 * gun_scale)), (9.0 * gun_scale, 3.5 * gun_scale, 3.8 * gun_scale), "leather", gun_axes)
    receiver = add(pose.gun_start, mul(gun_direction, 10.5 * gun_scale))
    add_box(mesh, receiver, (7.0 * gun_scale, 4.1 * gun_scale, 4.2 * gun_scale), "metal_dark", gun_axes)
    gun_right = gun_axes[1]
    for side in (-1.0, 1.0):
        barrel_start = add(pose.gun_start, mul(gun_direction, 12.0 * gun_scale))
        barrel_start = add(barrel_start, mul(gun_right, side * 1.05 * gun_scale))
        barrel_end = add(pose.gun_end, mul(gun_right, side * 1.05 * gun_scale))
        add_prism(mesh, barrel_start, barrel_end, 0.85 * gun_scale, 0.75 * gun_scale, "metal", sides=6)

    # A brutal, improvised mattock replaces Quake's axe silhouette.
    tool_direction = normalize(sub(pose.tool_end, pose.tool_start))
    tool_scale = pose.tool_scale
    add_prism(
        mesh,
        pose.tool_start,
        pose.tool_end,
        0.85 * tool_scale,
        0.75 * tool_scale,
        "leather",
        sides=6,
    )
    tool_axes = axes_from_forward(tool_direction, mat_vec(axes, (0.0, 1.0, 0.0)))
    add_box(mesh, pose.tool_end, (3.2 * tool_scale, 12.5 * tool_scale, 3.0 * tool_scale), "metal_dark", tool_axes)
    return mesh


def build_skin(palette_bytes: bytes, portrait_path: Path) -> bytes:
    palette = [tuple(palette_bytes[index : index + 3]) for index in range(0, 768, 3)]
    atlas = Image.new("RGB", (SKIN_WIDTH, SKIN_HEIGHT), (42, 25, 18))
    draw = ImageDraw.Draw(atlas)
    colors = {
        "skin": (180, 116, 83),
        "skin_dark": (119, 67, 48),
        "denim": (24, 48, 69),
        "denim_dark": (11, 27, 43),
        "boot": (31, 25, 20),
        "leather": (77, 43, 25),
        "mustache": (48, 28, 20),
        "metal": (116, 121, 116),
        "metal_dark": (47, 52, 51),
        "eye": (10, 8, 7),
        "patch": (177, 116, 43),
        "blood": (99, 16, 12),
    }
    for name, (x, y) in SWATCHES.items():
        draw.rectangle((x - 3, y - 3, x + 3, y + 3), fill=colors[name])

    portrait = Image.open(portrait_path).convert("RGBA")
    source_width, source_height = portrait.size
    crop = portrait.crop(
        (
            int(source_width * 0.13),
            int(source_height * 0.025),
            int(source_width * 0.72),
            int(source_height * 0.43),
        )
    )
    face = ImageOps.fit(crop, (64, 64), method=Image.Resampling.LANCZOS, centering=(0.48, 0.34))
    face = ImageEnhance.Contrast(face).enhance(1.18)
    face = ImageEnhance.Color(face).enhance(0.76)
    face_background = Image.new("RGBA", face.size, colors["skin"] + (255,))
    face_background.alpha_composite(face)
    atlas.paste(face_background.convert("RGB"), (0, 0))

    # Quantize manually so Quake's reserved shirt/pants translation ramps never
    # recolor Phipps's face or overalls when the player color changes.
    safe_indices = [index for index in range(256) if not (16 <= index <= 31 or 96 <= index <= 111)]
    cache: dict[tuple[int, int, int], int] = {}
    indexed = bytearray()
    for pixel in atlas.getdata():
        if pixel not in cache:
            cache[pixel] = min(
                safe_indices,
                key=lambda index: (
                    (palette[index][0] - pixel[0]) ** 2
                    + (palette[index][1] - pixel[1]) ** 2
                    + (palette[index][2] - pixel[2]) ** 2
                ),
            )
        indexed.append(cache[pixel])
    return bytes(indexed)


def closest_alias_normal(normal: Vec3) -> int:
    return max(ALIAS_NORMALS, key=lambda item: dot(normal, item[1]))[0]


def make_phipps_player_model(source_model: bytes, palette_bytes: bytes, portrait_path: Path) -> bytes:
    """Return a classic Quake v6 alias model with 143 animated Phipps poses."""
    source_header = struct.unpack_from("<2i3f3ff3f8if", source_model, 0)
    if source_header[0] != 1330660425 or source_header[1] != 6:
        raise ValueError("Expected a Quake v6 alias player model")
    if source_header[17] != len(FRAME_NAMES):
        raise ValueError(
            f"LibreQuake player has {source_header[17]} frames; Phipps expects {len(FRAME_NAMES)}"
        )

    frames = [build_frame(index) for index in range(len(FRAME_NAMES))]
    reference = frames[0]
    if len(reference.positions) > 1024:
        raise ValueError(f"Phipps model has {len(reference.positions)} vertices; classic Quake allows 1024")
    for index, frame in enumerate(frames[1:], 1):
        if frame.texcoords != reference.texcoords or frame.triangles != reference.triangles:
            raise ValueError(f"Phipps frame {index} changed model topology")

    all_positions = [position for frame in frames for position in frame.positions]
    mins = [min(point[axis] for point in all_positions) - 0.1 for axis in range(3)]
    maxs = [max(point[axis] for point in all_positions) + 0.1 for axis in range(3)]
    scales = [(maxs[axis] - mins[axis]) / 255.0 for axis in range(3)]
    radius = max(length(point) for point in all_positions)
    skin = build_skin(palette_bytes, portrait_path)

    payload = bytearray(
        struct.pack(
            "<2i3f3ff3f8if",
            1330660425,
            6,
            *scales,
            *mins,
            radius,
            0.0,
            0.0,
            22.0,
            1,
            SKIN_WIDTH,
            SKIN_HEIGHT,
            len(reference.positions),
            len(reference.triangles),
            len(frames),
            0,
            0,
            radius / 24.0,
        )
    )
    payload.extend(struct.pack("<i", 0))
    payload.extend(skin)
    for s, t in reference.texcoords:
        payload.extend(struct.pack("<iii", 0, s, t))
    for triangle in reference.triangles:
        payload.extend(struct.pack("<iiii", 1, *triangle))

    for name, frame in zip(FRAME_NAMES, frames):
        quantized: list[tuple[int, int, int]] = []
        for point in frame.positions:
            quantized.append(
                tuple(
                    max(0, min(255, round((point[axis] - mins[axis]) / scales[axis])))
                    for axis in range(3)
                )
            )
        bbox_min = tuple(min(point[axis] for point in quantized) for axis in range(3))
        bbox_max = tuple(max(point[axis] for point in quantized) for axis in range(3))
        payload.extend(struct.pack("<i", 0))
        payload.extend(struct.pack("<4B", *bbox_min, 0))
        payload.extend(struct.pack("<4B", *bbox_max, 0))
        payload.extend(name.encode("ascii")[:15].ljust(16, b"\0"))
        for point, normal in zip(quantized, frame.normals):
            payload.extend(struct.pack("<4B", *point, closest_alias_normal(normal)))
    return bytes(payload)

