#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
يولّد الأصول الأولية للمنصة (من غير ما تحتاج Blender):
  - assets/models/mr_nokrashy.gltf     مجسم مستر نقراشي (بدلة + طربوش + نضارة + شنب) مع Blend Shapes للفم
  - assets/textures/scanlines.png      خامة خطوط مسح الهولوجرام
  - assets/audio/ui_*.wav              مؤثرات صوتية سينمائية للواجهة

التشغيل:  python3 tools/generate_assets.py

لما يجهز المجسم الحقيقي استبدل mr_nokrashy.gltf بيه، وخلّي أسماء الـ nodes دي:
  Head, ArmR, ArmL, EyeL, EyeR  وأسماء الـ Blend Shapes: jawOpen, mouthWide, mouthRound, mouthSmile
(أو الأسماء المكافئة: mouthOpen, viseme_aa, viseme_O, viseme_E ...)
"""
import base64
import json
import math
import os
import struct
import wave
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))


# ───────────────────────── هندسة بسيطة ─────────────────────────
def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


def sphere(r, su=28, sv=18):
    pos, nor, idx = [], [], []
    for j in range(sv + 1):
        phi = math.pi * j / sv
        for i in range(su + 1):
            th = 2 * math.pi * i / su
            x, y, z = math.sin(phi) * math.cos(th), math.cos(phi), math.sin(phi) * math.sin(th)
            pos.append((r * x, r * y, r * z))
            nor.append((x, y, z))
    for j in range(sv):
        for i in range(su):
            a = j * (su + 1) + i
            b = a + su + 1
            idx += [a, b, a + 1, b, b + 1, a + 1]
    return pos, nor, idx


def box(w, h, d):
    hw, hh, hd = w / 2, h / 2, d / 2
    faces = [
        ((0, 0, 1), [(-hw, -hh, hd), (hw, -hh, hd), (hw, hh, hd), (-hw, hh, hd)]),
        ((0, 0, -1), [(hw, -hh, -hd), (-hw, -hh, -hd), (-hw, hh, -hd), (hw, hh, -hd)]),
        ((1, 0, 0), [(hw, -hh, hd), (hw, -hh, -hd), (hw, hh, -hd), (hw, hh, hd)]),
        ((-1, 0, 0), [(-hw, -hh, -hd), (-hw, -hh, hd), (-hw, hh, hd), (-hw, hh, -hd)]),
        ((0, 1, 0), [(-hw, hh, hd), (hw, hh, hd), (hw, hh, -hd), (-hw, hh, -hd)]),
        ((0, -1, 0), [(-hw, -hh, -hd), (hw, -hh, -hd), (hw, -hh, hd), (-hw, -hh, hd)]),
    ]
    pos, nor, idx = [], [], []
    for n, vs in faces:
        b = len(pos)
        pos += vs
        nor += [n] * 4
        idx += [b, b + 1, b + 2, b, b + 2, b + 3]
    return pos, nor, idx


def frustum(rb, rt, h, seg=32, y0=0.0):
    """مخروط ناقص: نصف قطر القاعدة rb عند y0 ونصف قطر القمة rt عند y0+h."""
    pos, nor, idx = [], [], []
    slope = (rb - rt) / h
    for i in range(seg + 1):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a), math.sin(a)
        n = norm((c, slope, s))
        pos.append((rb * c, y0, rb * s))
        nor.append(n)
        pos.append((rt * c, y0 + h, rt * s))
        nor.append(n)
    for i in range(seg):
        a = 2 * i
        idx += [a, a + 1, a + 2, a + 1, a + 3, a + 2]
    for r, y, ny in ((rt, y0 + h, 1.0), (rb, y0, -1.0)):
        base = len(pos)
        pos.append((0.0, y, 0.0))
        nor.append((0.0, ny, 0.0))
        for i in range(seg + 1):
            a = 2 * math.pi * i / seg
            pos.append((r * math.cos(a), y, r * math.sin(a)))
            nor.append((0.0, ny, 0.0))
        for i in range(seg):
            idx += [base, base + 1 + i, base + 2 + i]
    return pos, nor, idx


def torus(R, r, su=28, sv=8):
    pos, nor, idx = [], [], []
    for i in range(su + 1):
        u = 2 * math.pi * i / su
        for j in range(sv + 1):
            v = 2 * math.pi * j / sv
            pos.append(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v)))
            nor.append(norm((math.cos(v) * math.cos(u), math.cos(v) * math.sin(u), math.sin(v))))
    for i in range(su):
        for j in range(sv):
            a = i * (sv + 1) + j
            b = a + sv + 1
            idx += [a, b, a + 1, b, b + 1, a + 1]
    return pos, nor, idx


def mouth_points(a, b, cy=0.0, smile=0.0, n=24):
    pts = [(0.0, cy, 0.0)]
    for i in range(n):
        th = 2 * math.pi * i / n
        c = math.cos(th)
        pts.append((a * c, cy + b * math.sin(th) + smile * c * c, 0.0))
    return pts


# ───────────────────────── glTF Builder ─────────────────────────
def qx(a):
    return [math.sin(a / 2), 0, 0, math.cos(a / 2)]


def qz(a):
    return [0, 0, math.sin(a / 2), math.cos(a / 2)]


def flat(lst):
    return [c for v in lst for c in v]


class GLTFBuilder:
    def __init__(self):
        self.bin = bytearray()
        self.views, self.accessors, self.meshes, self.nodes = [], [], [], []

    def _accessor(self, values, comp, kind, target=None, minmax=False):
        n_comp = 3 if kind == "VEC3" else 1
        while len(self.bin) % 4:
            self.bin.append(0)
        offset = len(self.bin)
        fmt = {5126: "f", 5123: "H", 5125: "I"}[comp]
        data = struct.pack("<%d%s" % (len(values), fmt), *values)
        self.bin.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        self.views.append(view)
        acc = {"bufferView": len(self.views) - 1, "componentType": comp, "count": len(values) // n_comp, "type": kind}
        if minmax:
            acc["min"] = [min(values[k::3]) for k in range(3)]
            acc["max"] = [max(values[k::3]) for k in range(3)]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def add_mesh(self, name, geom, morphs=None, target_names=None):
        pos, nor, idx = geom
        prim = {
            "attributes": {
                "POSITION": self._accessor(flat(pos), 5126, "VEC3", 34962, True),
                "NORMAL": self._accessor(flat(nor), 5126, "VEC3", 34962),
            },
            "indices": self._accessor(idx, 5123 if max(idx) < 65535 else 5125, "SCALAR", 34963),
            "mode": 4,
        }
        mesh = {"name": name, "primitives": [prim]}
        if morphs:
            prim["targets"] = [{"POSITION": self._accessor(flat(m), 5126, "VEC3", 34962, True)} for m in morphs]
            mesh["weights"] = [0.0] * len(morphs)
            mesh["extras"] = {"targetNames": target_names}
        self.meshes.append(mesh)
        return len(self.meshes) - 1

    def node(self, name, mesh=None, t=None, r=None, children=None):
        n = {"name": name}
        if mesh is not None:
            n["mesh"] = mesh
        if t:
            n["translation"] = list(t)
        if r:
            n["rotation"] = list(r)
        if children:
            n["children"] = children
        self.nodes.append(n)
        return len(self.nodes) - 1

    def save(self, path, root):
        while len(self.bin) % 4:
            self.bin.append(0)
        uri = "data:application/octet-stream;base64," + base64.b64encode(bytes(self.bin)).decode()
        doc = {
            "asset": {"version": "2.0", "generator": "mr-nokrashy-placeholder"},
            "scene": 0,
            "scenes": [{"name": "Scene", "nodes": [root]}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.bin), "uri": uri}],
        }
        with open(path, "w") as f:
            json.dump(doc, f)


def build_model(path):
    g = GLTFBuilder()
    M, N = g.add_mesh, g.node

    # الفم: قرص بيتغير شكله بالـ Blend Shapes (Visemes)
    base = mouth_points(0.085, 0.006)
    shapes = {
        "jawOpen": dict(a=0.075, b=0.045, cy=-0.03),
        "mouthWide": dict(a=0.12, b=0.012),
        "mouthRound": dict(a=0.04, b=0.038, cy=-0.015),
        "mouthSmile": dict(a=0.10, b=0.008, smile=0.03),
    }
    deltas = [[tuple(t[k] - b[k] for k in range(3)) for t, b in zip(mouth_points(**kw), base)] for kw in shapes.values()]
    fan = []
    for i in range(1, 25):
        fan += [0, i, i + 1 if i < 24 else 1]
    mouth = M("Mouth", (base, [(0, 0, 1)] * len(base), fan), morphs=deltas, target_names=list(shapes.keys()))

    head = N("Head", t=(0, 1.75, 0), children=[
        N("HeadMesh", M("HeadMesh", sphere(0.5))),
        N("Tarboosh", M("Tarboosh", frustum(0.34, 0.28, 0.38)), t=(0, 0.40, 0), r=qx(0.08)),
        N("Tassel", M("Tassel", box(0.03, 0.30, 0.03)), t=(0.27, 0.62, 0), r=qz(-0.12)),
        N("EyeL", M("EyeL", sphere(0.05, 12, 8)), t=(0.17, 0.07, 0.45)),
        N("EyeR", M("EyeR", sphere(0.05, 12, 8)), t=(-0.17, 0.07, 0.45)),
        N("GlassesL", M("GlassesL", torus(0.105, 0.011)), t=(0.17, 0.07, 0.47)),
        N("GlassesR", M("GlassesR", torus(0.105, 0.011)), t=(-0.17, 0.07, 0.47)),
        N("GlassesBridge", M("GlassesBridge", box(0.1, 0.014, 0.014)), t=(0, 0.09, 0.485)),
        N("Nose", M("Nose", sphere(0.055, 12, 8)), t=(0, -0.03, 0.5)),
        N("MustacheL", M("MustacheL", box(0.17, 0.045, 0.05)), t=(0.09, -0.105, 0.49), r=qz(0.18)),
        N("MustacheR", M("MustacheR", box(0.17, 0.045, 0.05)), t=(-0.09, -0.105, 0.49), r=qz(-0.18)),
        N("Mouth", mouth, t=(0, -0.2, 0.47)),
    ])

    def arm(name, side):
        return N(name, t=(side * 0.64, 1.1, 0), children=[
            N(name + "Mesh", M(name + "Mesh", frustum(0.09, 0.12, 0.9, 20, y0=-0.9))),
            N(name + "Hand", M(name + "Hand", sphere(0.11, 16, 10)), t=(0, -0.98, 0)),
        ])

    root = N("Mr_Nokrashy", t=(0, 0.95, 0), children=[
        N("Body", M("Body", box(1.1, 1.25, 0.55)), t=(0, 0.625, 0)),
        N("Neck", M("Neck", frustum(0.17, 0.17, 0.3, 16)), t=(0, 1.15, 0)),
        N("BowTieL", M("BowTieL", box(0.15, 0.09, 0.04)), t=(0.1, 1.18, 0.29), r=qz(0.2)),
        N("BowTieR", M("BowTieR", box(0.15, 0.09, 0.04)), t=(-0.1, 1.18, 0.29), r=qz(-0.2)),
        N("BowTieKnot", M("BowTieKnot", sphere(0.04, 10, 8)), t=(0, 1.18, 0.3)),
        N("LegL", M("LegL", box(0.4, 0.95, 0.42)), t=(0.26, -0.475, 0)),
        N("LegR", M("LegR", box(0.4, 0.95, 0.42)), t=(-0.26, -0.475, 0)),
        N("ShoeL", M("ShoeL", box(0.42, 0.12, 0.62)), t=(0.26, -0.94, 0.08)),
        N("ShoeR", M("ShoeR", box(0.42, 0.12, 0.62)), t=(-0.26, -0.94, 0.08)),
        head,
        arm("ArmR", -1),  # يمينه هو (المجسم بيبص ناحية +Z)
        arm("ArmL", 1),
    ])
    g.save(path, root)


# ───────────────────────── خامة الخطوط ─────────────────────────
def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def build_scanlines(path):
    w, h = 4, 16
    rows = []
    for y in range(h):
        v = 255 if y < 3 else 150 if y < 6 else 70
        rows.append([(v, v, v, 255)] * w)
    write_png(path, w, h, rows)


# ───────────────────────── المؤثرات الصوتية ─────────────────────────
SR = 22050


def synth(segments, vol=0.35):
    out, phase = [], 0.0
    for f0, f1, dur, kind in segments:
        n = int(SR * dur)
        for i in range(n):
            t, k = i / SR, i / max(1, n - 1)
            phase += 2 * math.pi * (f0 + (f1 - f0) * k) / SR
            if kind == "sq":
                s = 0.5 if math.sin(phase) >= 0 else -0.5
            else:
                s = math.sin(phase) + 0.3 * math.sin(2 * phase)
            out.append(s * min(1.0, t / 0.004) * math.exp(-3.5 * k))
    peak = max(abs(x) for x in out) or 1.0
    return [x / peak * vol for x in out]


def save_wav(path, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1.0, min(1.0, x)) * 32767)) for x in samples))


def build_sounds(folder):
    sounds = {
        "hover": [(1200, 1500, 0.05, "sin")],
        "click": [(800, 1600, 0.08, "sin"), (1600, 1600, 0.04, "sin")],
        "gesture": [(900, 1200, 0.08, "sin")],
        "boot": [(180, 1400, 0.45, "sin"), (880, 880, 0.08, "sin"), (1175, 1175, 0.08, "sin"), (1760, 1760, 0.18, "sin")],
        "success": [(660, 660, 0.09, "sin"), (880, 880, 0.09, "sin"), (1320, 1320, 0.2, "sin")],
        "error": [(320, 150, 0.28, "sq")],
    }
    for name, segs in sounds.items():
        save_wav(os.path.join(folder, "ui_%s.wav" % name), synth(segs, 0.4 if name != "hover" else 0.18))


if __name__ == "__main__":
    for sub in ("models", "textures", "audio"):
        os.makedirs(os.path.join(ASSETS, sub), exist_ok=True)
    build_model(os.path.join(ASSETS, "models", "mr_nokrashy.gltf"))
    build_scanlines(os.path.join(ASSETS, "textures", "scanlines.png"))
    build_sounds(os.path.join(ASSETS, "audio"))
    print("تم توليد الأصول في:", ASSETS)
