"""Extend Legend reflections onto costume fabric, preserving face/skin guards.

Uses the same 180-alpha material range as Wonderland. Polygons keep the new
material on clothing/armour; the original trim and background masks are retained.
Run after replacing the original Legend masks, or rerun safely on current masks.
"""
import base64
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "assets/skins/foils"
# Normalized costume silhouettes, excluding hair, wings and background.
COSTUMES = {
    "zombie-male": [[(.02,.52),(.32,.43),(.52,.57),(.92,.48),(1,1),(.08,1)]],
    "zombie-female": [[(.08,.70),(.42,.53),(.60,.69),(.89,.54),(1,1),(.10,1)]],
    "pirate-male": [[(.06,.65),(.39,.48),(.60,.65),(.91,.48),(1,1),(.12,1)]],
    "pirate-female": [[(.05,.65),(.40,.52),(.62,.68),(.94,.49),(1,1),(.12,1)]],
    "elf-male": [[(0,.56),(.28,.52),(.52,.65),(.79,.51),(.94,1),(0,1)]],
    "elf-female": [[(.12,.73),(.43,.59),(.64,.67),(.90,.52),(1,1),(.10,1)]],
    "viking-male": [[(.03,.66),(.35,.58),(.58,.69),(.88,.60),(1,1),(0,1)]],
    "viking-female": [[(.02,.57),(.29,.47),(.51,.62),(.89,.49),(1,1),(0,1)]],
    "dragon-knight": [[(.10,.66),(.39,.49),(.63,.51),(.86,.65),(1,1),(0,1)]],
    "angel-j": [[(.13,.70),(.39,.53),(.61,.64),(.86,.55),(1,1),(.04,1)]],
    "angel-q": [[(.04,.75),(.39,.57),(.61,.64),(.87,.51),(1,1),(0,1)]],
    "angel-k": [[(.06,.66),(.35,.55),(.58,.63),(.87,.54),(1,1),(0,1)]],
    "demon-j": [[(.06,.72),(.32,.60),(.56,.73),(.84,.56),(1,1),(0,1)]],
    "demon-q": [[(.06,.71),(.38,.56),(.61,.65),(.90,.52),(1,1),(0,1)]],
    "demon-k": [[(.02,.68),(.29,.58),(.52,.72),(.83,.57),(1,1),(0,1)]],
    "genie-magician": [[(.05,.68),(.38,.55),(.63,.66),(.89,.55),(1,1),(0,1)]],
}


def build():
    path = ROOT / "masks.json"
    entries = json.loads(path.read_text())
    for name, polygons in COSTUMES.items():
        entry = entries[name]
        w, h = entry["width"], entry["height"]
        art = Image.open(ROOT / (name + ".webp")).convert("RGB").resize(
            (w, h), Image.Resampling.LANCZOS)
        region = Image.new("L", (w, h))
        draw = ImageDraw.Draw(region)
        for polygon in polygons:
            draw.polygon([(round(x*w), round(y*h)) for x, y in polygon], fill=255)
        material = bytearray(base64.b64decode(entry["alpha"]))
        before = sum(v > 0 for v in material)
        for y in range(h):
            for x in range(w):
                nx, ny = (x+.5)/w, (y+.5)/h
                if not region.getpixel((x, y)):
                    continue
                if any(l <= nx <= r and t <= ny <= b
                       for l, t, r, b in entry.get("protected", [])):
                    continue
                r, g, b = art.getpixel((x, y))
                light, dark = max(r, g, b), min(r, g, b)
                saturation = (light-dark)/max(1, light)
                # Include navy/purple cloth and pale armour, following painted
                # folds rather than covering the costume in a flat opaque wash.
                strength = min(1, max(0, (light-28)/150))
                strength *= min(1, max(.35, saturation/.55))
                material[y*w+x] = max(material[y*w+x], round(180*strength))
        entry["alpha"] = base64.b64encode(material).decode()
        print(name, before, "→", sum(v > 0 for v in material), "material pixels")
    path.write_text(json.dumps(entries, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    build()
