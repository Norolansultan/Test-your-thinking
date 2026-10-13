"""
`python tools/topo-map/render.py` (step 2 of 2) — rasterises the vector
layers written by `npm run map:build` (SPEC/23 §11) into the basemap image,
in the style of the MML 1:50 000 sheet used for preview (`app/render/ui/public/maps/L521.png`).

Reads:
  content/site/build/topo-features.json   vector layers in map pixels (step 1)

Writes:
  app/render/ui/public/maps/topo.webp     the basemap at app/scenario/site-meta.json's "image"
  app/render/ui/public/maps/topo/r_c.webp its 4 x 4 tiles, which the UI loads (site-meta.json "tiles")
  app/render/ui/public/maps/topo-en/r_c.webp
                                          the same tiles with the English labels (revision (ae),
                                          9 Oct 2026: "labelsEn", the names from
                                          app/i18n/place-names.ts), loaded in English sessions

The map is drawn once; only the labels differ between the languages, so the two are identical
pixel for pixel away from the labels. Deterministic: the paper grain is seeded, everything else is
drawn from topo-features.json, and a second run writes the same bytes (checked 9 Oct 2026, Pillow
12.3.0, Python 3.14.3, Windows fonts).
"""

import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURES_PATH = os.path.join(ROOT, "content", "site", "build", "topo-features.json")
OUT_PATH = os.path.join(ROOT, "app", "render", "ui", "public", "maps", "topo.webp")
FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")

# Supersample factor: draw at SS× and downsample with LANCZOS for anti-aliased
# lines and polygon edges (PIL's ImageDraw itself does not antialias).
SS = 2
# Rows per strip for the numpy passes (revision (al): bounds the peak memory).
STRIP = 1000

# ---------------------------------------------------------------------------
# Palette — sampled from the MML Maastokartta 1:50 000 legend ("Merkkienselite",
# 5.9.2025, maastokartta_karttamerkkien_selite_2025.pdf p. 2). Symbol sizes are
# the legend's millimetres at 1:50 000 (1 mm = 50 m = 12.5 px on this 4 m/px map).
# ---------------------------------------------------------------------------

BG_LOW = (247, 246, 240)  # "metsäinen alue (valkea)": forest is white; faint paper grain only
BG_HIGH = (255, 255, 253)
WATER_FILL = (109, 207, 246)  # vesialue
WATER_OUTLINE = (0, 113, 187)  # rantaviiva
RIVER_COLOR = (0, 113, 187)
BROOK_COLOR = (0, 113, 187)  # puro tai oja
FIELD_FILL = (254, 216, 143)  # pelto
OPEN_BOG_FILL = (213, 191, 96)  # suo: puuton
PINE_BOG_FILL = (196, 214, 223)  # suo: metsäinen
DRAINED_BOG_FILL = (196, 214, 223)  # ditched mire is still "metsäinen suo"; the ditches carry the difference
PALUDIFIED_FILL = (225, 234, 238)  # soistuma
# vaikeakulkuinen suo: horizontal lines on 0.6 mm pitch. Revision (al), 10 Oct 2026 (map review panel):
# lighter and half as thick (was (61, 182, 223), 2 px), so the blue unit markers do not fade into the hatching.
MIRE_LINE = (150, 210, 236)
MIRE_LINE_WIDTH = 1
# oja, leveys alle 2 m. Revision (al): lighter (was (0, 113, 187), the legend's blue), so the blue unit
# markers on the drained mires (Rahkasuo) do not fade into the ditch hatching.
DITCH_COLOR = (88, 160, 212)
ROCK_FILL = (214, 212, 206)  # avokallio — neutral grey here, not MML pink: pink reads as the fire projection (SPEC/12 rev. 24 Sep (c))
CONTOUR_COLOR = (170, 150, 122)  # pääkäyrä 5 m — muted, not MML orange-brown, which competes with the fire colours
CONTOUR_INDEX_COLOR = (170, 150, 122)  # johtokäyrä 20 m: same hue, heavier line
ROAD_RED = (112, 110, 106)  # II a/b autotie — grey, not MML red: red is reserved for the fire now (SPEC/12 rev. 24 Sep (c))
ROAD_RED_III = (132, 129, 124)  # III a/b yksikaistainen autotie — grey, as above
ROAD_BLACK = (34, 31, 31)  # ajotie, ajopolku, polku; II-class centreline
POWERLINE_COLOR = (45, 45, 45)
# Revision (al): the 110 kV line's 36 m cleared corridor, open ground under the line (the CA has it as
# "cleared_corridor"); the same pale tone is used for the log landing at the R2 junction.
CLEARED_FILL = (244, 230, 186)
CLEARED_OUTLINE = (150, 140, 120)
BUILDING_COLOR = (87, 88, 90)  # asuin-, loma-, liike- ja yleisiä rakennuksia
BUILDING_OTHER_FILL = (209, 210, 212)  # muita rakennuksia (sauna, barn, hut)
BRIDGE_COLOR = (40, 40, 40)
LABEL_BLACK = (30, 30, 30)
LABEL_WATER = (40, 92, 152)
LABEL_TERRAIN = (94, 66, 40)
LABEL_HEIGHT = (140, 122, 98)


def load_features():
    with open(FEATURES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def scale(pt, s=SS):
    return (pt[0] * s, pt[1] * s)


def scale_ring(ring, s=SS):
    return [tuple(scale(p, s)) for p in ring]


def draw_dashed_polyline(draw, pts, color, width, dash=10, gap=8):
    """PIL has no native dashed line; walk the polyline and draw on/off runs."""
    if len(pts) < 2:
        return
    on = True
    remaining = dash
    for a, b in zip(pts, pts[1:]):
        seg_len = math.hypot(b[0] - a[0], b[1] - a[1])
        t = 0.0
        while t < seg_len:
            step = min(remaining, seg_len - t)
            t0, t1 = t / seg_len, (t + step) / seg_len
            if on:
                p0 = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
                p1 = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
                draw.line([p0, p1], fill=color, width=width)
            t += step
            remaining -= step
            if remaining <= 0:
                on = not on
                remaining = dash if on else gap


def font(path, size):
    try:
        return ImageFont.truetype(os.path.join(FONTS, path), size)
    except OSError:
        return ImageFont.load_default()


def paper_texture(size_px, low, high, seed=20260923):
    """Low-frequency mottled tint, standing in for print/paper grain and canopy-density
    variation — flat colour reads as obviously computer-generated next to L521's scan."""
    rng = np.random.default_rng(seed)
    lo_res = 96
    noise = rng.random((lo_res, lo_res), dtype=np.float64).astype(np.float32)
    tile = Image.fromarray((noise * 255).astype(np.uint8), mode="L").resize((size_px, size_px), Image.BICUBIC)
    # Revision (al): computed in strips of rows (the same arithmetic, element by element) so the
    # supersampled 10 000 px map does not need several GB of float arrays at once.
    t8 = np.asarray(tile)
    n_min = np.float32(t8.min()) / np.float32(255.0)
    n_max = np.float32(t8.max()) / np.float32(255.0)
    low_a = np.array(low, dtype=np.float32)
    high_a = np.array(high, dtype=np.float32)
    out = np.empty((size_px, size_px, 3), dtype=np.uint8)
    for r0 in range(0, size_px, STRIP):
        n = t8[r0:r0 + STRIP].astype(np.float32) / 255.0
        n = (n - n_min) / (n_max - n_min)
        out[r0:r0 + STRIP] = (low_a[None, None, :] + (high_a - low_a)[None, None, :] * n[:, :, None]).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


def box_blur(z, passes=6):
    """A few box-blur passes approximate a gaussian — smooths the fine-grained noise out of the
    elevation grid so the hillshade reads as broad relief, not per-cell texture. No scipy
    dependency: plain numpy, edges handled by clamped padding."""
    out = z.copy()
    for _ in range(passes):
        p = np.pad(out, 1, mode="edge")
        out = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * p[1:-1, 1:-1]) / 8.0
    return out


def hillshade_layer(elevation_grid, size_px, azimuth_deg=315, altitude_deg=55, strength=0.09):
    """Standard cartographic hillshade (higher/lower ground visible beyond the contour lines
    alone, per the L521 comparison) — a subtle multiplicative light/shadow layer, applied under
    the line and point features so they stay crisp on top of it."""
    n = elevation_grid["size"]
    z = np.asarray(elevation_grid["values"], dtype=np.float32).reshape(n, n)
    z = box_blur(z, passes=6)
    # North is +y in this grid (row 0 = north edge, terrain.ts's cellY runs -HALF..+HALF then
    # build.ts samples top-to-bottom), so a north-up image needs the gradient flipped in y.
    gy, gx = np.gradient(z)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az = math.radians(360 - azimuth_deg + 90)
    alt = math.radians(altitude_deg)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    shade = np.clip(shade, 0, 1)
    tile = Image.fromarray((shade * 255).astype(np.uint8), mode="L").resize((size_px, size_px), Image.BICUBIC)
    return (np.asarray(tile), strength)  # the factor is made strip by strip in apply_hillshade


def apply_hillshade(im, shade_and_strength):
    """Multiply onto RGB: darker in shadow, brighter on sunlit slopes. Revision (al): in strips of
    rows, the same arithmetic as before element by element (memory, not the picture, changed)."""
    shade8, strength = shade_and_strength
    src = np.asarray(im)
    out = np.empty_like(src)
    for r0 in range(0, src.shape[0], STRIP):
        factor = 1.0 - strength + strength * (shade8[r0:r0 + STRIP].astype(np.float32) / 255.0)
        arr = src[r0:r0 + STRIP].astype(np.float32)
        arr *= factor[:, :, None]
        out[r0:r0 + STRIP] = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


def main():
    fx = load_features()
    size_px = fx["size"] * SS
    im = paper_texture(size_px, BG_LOW, BG_HIGH)
    draw = ImageDraw.Draw(im)

    # --- exposed bedrock: plain avokallio fill (the legend has no texture for it) ----
    for ring in fx["rocky"]:
        draw.polygon(scale_ring(ring), fill=ROCK_FILL)

    # --- the 110 kV line's cleared corridor (revision (al)): under fields, mires and water, which
    # draw over it, as in the fire model's grid, where field, bog and water take precedence ----------
    if len(fx["powerLine"]) >= 2:
        draw.line(scale_ring(fx["powerLine"]), fill=CLEARED_FILL, width=int(round(fx["powerCorridorPx"] * SS)))
    # --- the log landing at the R2 junction (revision (al)): open ground, thin outline ----------
    for ring in fx["clearings"]:
        draw.polygon(scale_ring(ring), fill=CLEARED_FILL, outline=CLEARED_OUTLINE, width=SS)

    # --- land cover, bottom to top -----------------------------------------
    for ring in fx["fields"]:
        draw.polygon(scale_ring(ring), fill=FIELD_FILL)
    for ring in fx["paludified"]:
        draw.polygon(scale_ring(ring), fill=PALUDIFIED_FILL)
    for ring in fx["openBogs"]:
        draw.polygon(scale_ring(ring), fill=OPEN_BOG_FILL)
    for ring in fx["pineBogs"]:
        draw.polygon(scale_ring(ring), fill=PINE_BOG_FILL)
    for ring in fx["drainedBogs"]:
        draw.polygon(scale_ring(ring), fill=DRAINED_BOG_FILL)

    # --- vaikeakulkuinen suo: continuous horizontal blue lines over the mire fill ----
    for line in fx["mireLines"]:
        draw.line(scale_ring(line), fill=MIRE_LINE, width=MIRE_LINE_WIDTH * SS)

    for ring in fx["water"]:
        pts = scale_ring(ring)
        draw.polygon(pts, fill=WATER_FILL, outline=WATER_OUTLINE, width=SS)
    for ring in fx["islands"]:
        draw.polygon(scale_ring(ring), fill=BG_HIGH, outline=WATER_OUTLINE, width=SS)
    # Revision (al): the farm pond at W2 (Lahdenkylän lampi), tiles only (not in the fire grids).
    for ring in fx["ponds"]:
        draw.polygon(scale_ring(ring), fill=WATER_FILL, outline=WATER_OUTLINE, width=SS)

    # --- hillshade: higher/lower ground, applied to the ground so far (background, rock,
    # fields, bogs, water) and BEFORE line/point features, which stay crisp on top of it -----
    im = apply_hillshade(im, hillshade_layer(fx["elevationGrid"], size_px, strength=0.06))
    draw = ImageDraw.Draw(im)

    # --- ditches: solid thin blue lines (legend "puro tai oja, leveys alle 2 m") ----
    for line in fx["ditches"]:
        draw.line(scale_ring(line), fill=DITCH_COLOR, width=max(1, SS))

    # --- contours --------------------------------------------------------------
    for c in fx["contours"]:
        pts = scale_ring(c["pts"])
        if len(pts) < 2:
            continue
        if c["index"]:
            draw.line(pts, fill=CONTOUR_INDEX_COLOR, width=2 * SS, joint="curve")
        else:
            draw.line(pts, fill=CONTOUR_COLOR, width=max(1, SS), joint="curve")

    # --- water courses ---------------------------------------------------------
    # "joki, leveys yli 5 m": water area between shorelines; the river is a list of runs (it is not
    # drawn across the lakes it flows through). Both outlines first, then the fill, so runs join cleanly.
    runs = [scale_ring(run) for run in fx["river"] if len(run) >= 2]
    for pts in runs:
        draw.line(pts, fill=RIVER_COLOR, width=5 * SS, joint="curve")
    for pts in runs:
        draw.line(pts, fill=WATER_FILL, width=3 * SS, joint="curve")
    for brook in fx["brooks"]:
        pts = scale_ring(brook)
        if len(pts) >= 2:
            draw.line(pts, fill=BROOK_COLOR, width=SS, joint="curve")

    # --- roads, per the legend's "Liikenneverkot" block, minor classes first ----------
    # polku: black dashes 0.95/0.24 mm, 0.1 mm; ajopolku: black dashes 1.4/0.2 mm, 0.14 mm.
    dashed = {"path": (SS * 2, 12 * SS, 3 * SS), "track": (SS * 3 // 2 + 1, 17 * SS, 3 * SS)}
    for cls in ("path", "track"):
        width, dash, gap = dashed[cls]
        for road in fx["roads"]:
            if road["cls"] == cls:
                draw_dashed_polyline(draw, scale_ring(road["pts"]), ROAD_BLACK, width, dash=dash, gap=gap)
    # ajotie (metsäautotie): solid black 0.14 mm.
    for road in fx["roads"]:
        pts = scale_ring(road["pts"])
        if road["cls"] == "forest" and len(pts) >= 2:
            draw.line(pts, fill=ROAD_BLACK, width=3, joint="curve")
    # III a/b yksikaistainen autotie: solid red 0.22 mm.
    for road in fx["roads"]:
        pts = scale_ring(road["pts"])
        if road["cls"] == "gravel" and len(pts) >= 2:
            draw.line(pts, fill=ROAD_RED_III, width=3 * SS, joint="curve")
    # II a/b kaksikaistainen autotie: red 0.45 mm with a dark dashed centreline.
    for road in fx["roads"]:
        pts = scale_ring(road["pts"])
        if road["cls"] == "main" and len(pts) >= 2:
            draw.line(pts, fill=ROAD_RED, width=5 * SS, joint="curve")
            draw_dashed_polyline(draw, pts, ROAD_BLACK, SS, dash=10 * SS, gap=4 * SS)

    # --- power line: smaller MML "sähkölinja" (electricity line) — a dark line with a short
    # cross tick every 100 m on the ground, without pylon dots
    pl_pts = scale_ring(fx["powerLine"])
    if len(pl_pts) >= 2:
        draw.line(pl_pts, fill=POWERLINE_COLOR, width=1 * SS)
        step_px = (100 / fx["metresPerPixel"]) * SS
        travelled = 0.0
        for a, b in zip(pl_pts, pl_pts[1:]):
            seg_len = math.hypot(b[0] - a[0], b[1] - a[1])
            if seg_len == 0:
                continue
            ux, uy = (b[0] - a[0]) / seg_len, (b[1] - a[1]) / seg_len
            nx, ny = -uy, ux
            t = step_px - (travelled % step_px)
            while t < seg_len:
                px, py = a[0] + ux * t, a[1] + uy * t
                r = 3 * SS
                draw.line([(px - nx * r, py - ny * r), (px + nx * r, py + ny * r)], fill=POWERLINE_COLOR, width=1 * SS)
                t += step_px
            travelled += seg_len

    # --- bridges ---------------------------------------------------------------
    for bridge in fx["bridges"]:
        bx, by = scale(bridge)
        r = 6 * SS
        draw.rectangle([bx - r, by - r * 0.5, bx + r, by + r * 0.5], outline=BRIDGE_COLOR, width=max(1, SS), fill=(255, 255, 255))

    # --- buildings: "asuin-, loma-, liike- ja yleisiä rakennuksia" (dark) and
    # "muita rakennuksia" (light grey, outlined) --------------------------------
    for b in fx["buildings"]:
        cx, cy = scale(b["px"])
        half = max(2 * SS, b["size"] * SS / 2)
        if b["kind"] == "other":
            half = max(1.5 * SS, half)
            draw.rectangle([cx - half, cy - half, cx + half, cy + half], fill=BUILDING_OTHER_FILL, outline=ROAD_BLACK, width=1)
        else:
            draw.rectangle([cx - half, cy - half, cx + half, cy + half], fill=BUILDING_COLOR)

    # --- labels: drawn on a copy per language; the Finnish map is the one it always was ------------
    base = im
    for labels, full_path, tile_dir_name in (
        (fx["labels"], OUT_PATH, "topo"),
        (fx["labelsEn"], None, "topo-en"),
    ):
        im = base.copy()
        draw_labels(ImageDraw.Draw(im), labels)
        im = im.resize((fx["size"], fx["size"]), Image.LANCZOS)
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        # WebP q90: ~5.6 MB against 24 MB as PNG, visually identical at 4 m/px. The PNG froze the
        # browser for tens of seconds while decoding (found in end-to-end testing, 24 Sep 2026).
        # The English map is written as tiles only: the UI loads nothing else.
        if full_path:
            im.save(full_path, quality=90, method=4)
        # The UI loads TILES x TILES pieces (site-meta.json "tiles", written by build.ts).
        tiles = 4
        step = fx["size"] // tiles
        tile_dir = os.path.join(os.path.dirname(OUT_PATH), tile_dir_name)
        os.makedirs(tile_dir, exist_ok=True)
        for r in range(tiles):
            for c in range(tiles):
                im.crop((c * step, r * step, (c + 1) * step, (r + 1) * step)).save(os.path.join(tile_dir, f"{r}_{c}.webp"), quality=90, method=4)
        print(f"wrote {full_path or tile_dir} ({fx['size']}x{fx['size']})")


def draw_labels(draw, labels):
    label_fonts = {
        "water": font("timesi.ttf", 15 * SS),
        "village": font("arialbd.ttf", 20 * SS),
        "place": font("arial.ttf", 14 * SS),
        "bog": font("timesi.ttf", 15 * SS),
        "terrain": font("timesi.ttf", 15 * SS),
        "height": font("arial.ttf", 11 * SS),
    }
    label_colors = {
        "water": LABEL_WATER,
        "village": LABEL_BLACK,
        "place": LABEL_BLACK,
        "bog": LABEL_TERRAIN,
        "terrain": LABEL_TERRAIN,
        "height": LABEL_HEIGHT,
    }
    for lb in labels:
        style = lb["style"]
        x, y = scale(lb["px"])
        if style == "height":
            r = 1.5 * SS
            draw.ellipse([x - r, y - r, x + r, y + r], fill=LABEL_HEIGHT)
            y += 3 * SS
        draw.text(
            (x, y),
            lb["text"],
            font=label_fonts.get(style, label_fonts["place"]),
            fill=label_colors.get(style, LABEL_BLACK),
            stroke_width=max(1, SS),
            stroke_fill=(255, 255, 255),
            anchor="lm",
        )


if __name__ == "__main__":
    main()
