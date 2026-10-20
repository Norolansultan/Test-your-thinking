"""
`python tools/topo-map/render.py` (step 2 of 2) — rasterises the vector layers written by `npm run map:build`
(SPEC/23 §11) into the basemap image, in the style of the National Land Survey's Karttapaikka maastokartta
(SPEC/33 §9 and §2.3 "Cartography"; palette and type in `render_style.py`, labels in `render_labels.py`).

Reads:
  content/site/build/topo-features.json   vector layers in map pixels (step 1)

Writes:
  app/render/ui/public/maps/topo.webp     the basemap at app/scenario/site-meta.json's "image"
  app/render/ui/public/maps/topo/r_c.webp its 4 x 4 tiles, which the UI loads (site-meta.json "tiles")
  app/render/ui/public/maps/topo-en/r_c.webp
                                          the same tiles with the English labels (SPEC/23 §16, "labelsEn")

Data-driven: every layer is optional and drawn only when present. Layers read (new name / today's name):
  polygons   rock|rocky, field_parcels (drawn as blocks) else fields, mireFill (the union) else mire_open|openBogs,
             mire_drained|drainedBogs, pineBogs and paludified; mireIslands (firm ground drawn back over the mire fill),
             peat_production, water, islands, ponds, clearings
  polylines  ditches (+ ditchKinds: main and collector ditches wider), contours (index flag "contours_index"|"index",
             height "level", "aux" auxiliary contours dashed), river, streams|brooks, roads (cls main|gravel|public|
             forest|private|track|path, optional "ref"), powerLine (+ powerCorridorPx)
  points     bridges, culverts, buildings, labels, labelsEn; elevationGrid (uphill side of the index-contour labels)
`mireLines` (the old difficult-mire hatching) is no longer drawn: §9 mires are a flat fill with their ditches.

The map is drawn once; only the names differ between the languages. Contour labels avoid both languages' names,
so the two maps are identical pixel for pixel away from the names. Deterministic: no randomness, fixed orders;
a second run writes the same bytes on the same platform and fonts (Arial on Windows, Liberation Sans elsewhere).
"""

import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True  # the helper modules are imported from this folder; keep it free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_areas as areas  # noqa: E402
import render_labels as lab  # noqa: E402
import render_style as st  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURES_PATH = os.path.join(ROOT, "content", "site", "build", "topo-features.json")
OUT_PATH = os.path.join(ROOT, "app", "render", "ui", "public", "maps", "topo.webp")

# Supersample factor: draw at SS× and downsample with LANCZOS (PIL's ImageDraw does not antialias).
SS = 2
TILES = 4
INDEX_INTERVAL_M = 20  # johtokäyrä, when contours carry a level but no flag


def load_features(path=FEATURES_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def sc(pts):
    return [(p[0] * SS, p[1] * SS) for p in pts]


def px(w):
    return max(1, int(round(w * SS)))


def fill_polygon(im, draw, item, fill, outline=None, width=0):
    """A polygon, with holes when it has them (drawn through a mask over its bounding box)."""
    rings = st.polygon_rings(item)
    if not rings:
        return
    if len(rings) == 1:
        draw.polygon(sc(rings[0]), fill=fill, outline=outline, width=width if outline else 0)
        return
    outer = sc(rings[0])
    x0, y0 = int(min(p[0] for p in outer)), int(min(p[1] for p in outer))
    x1, y1 = int(max(p[0] for p in outer)) + 2, int(max(p[1] for p in outer)) + 2
    mask = Image.new("L", (x1 - x0, y1 - y0), 0)
    md = ImageDraw.Draw(mask)
    md.polygon([(x - x0, y - y0) for x, y in outer], fill=255)
    for hole in rings[1:]:
        md.polygon([(x * SS - x0, y * SS - y0) for x, y in hole], fill=0)
    im.paste(fill, (x0, y0, x1, y1), mask)
    if outline:
        for r in rings:
            draw.line(sc(r) + sc(r[:1]), fill=outline, width=width)


def line(draw, pts, colour, width):
    if len(pts) >= 2:
        draw.line(sc(pts), fill=colour, width=px(width), joint="curve")


def dashed(draw, pts, colour, width, dash, gap):
    """PIL has no dashed line; walk the polyline in final px and draw the on-runs."""
    if len(pts) < 2:
        return
    cum = lab.cumlen(pts)
    s = 0.0
    while s < cum[-1]:
        seg = lab.sub_polyline(pts, cum, s, min(s + dash, cum[-1]))
        draw.line(sc(seg), fill=colour, width=px(width), joint="curve")
        s += dash + gap


def road_classes(fx):
    roads = fx.get("roads") or []
    known = set(st.ROAD_ORDER)
    order = sorted({r.get("cls") for r in roads} - known, key=str) + list(st.ROAD_ORDER)
    return roads, order


def draw_ground(im, draw, fx):
    """Area fills, bottom to top."""
    # the 110 kV corridor and the log landing: open ground, under everything else
    pl = fx.get("powerLine") or []
    if len(pl) >= 2 and fx.get("powerCorridorPx"):
        draw.line(sc(pl), fill=st.CLEARED_FILL, width=px(fx["powerCorridorPx"]))
    for ring in st.layer(fx, "clearings"):
        fill_polygon(im, draw, ring, st.CLEARED_FILL, st.CLEARED_EDGE, px(0.5))
    # one fill for every mire class and the paludified fringe: the union layer when the build wrote it (no seams)
    mires = st.layer(fx, "mireFill") or (st.layer(fx, "mire_open", "openBogs") + st.layer(fx, "mire_drained", "drainedBogs")
                                         + st.layers(fx, "pineBogs", "mire", "paludified"))
    for ring in mires:
        fill_polygon(im, draw, ring, st.MIRE_FILL)
    # firm islands in the mires: the traced mire rings carry no holes, so the islands are drawn back as land
    for ring in st.layer(fx, "mireIslands"):
        fill_polygon(im, draw, ring, st.BG)
    for ring in st.layer(fx, "rock", "rocky"):
        fill_polygon(im, draw, ring, st.ROCK_FILL)
    if fx.get("field_parcels"):
        areas.draw_field_blocks(im, fx["field_parcels"], SS, st.FIELD_FILL, st.FIELD_EDGE, st.W["field_edge"])
    else:
        for ring in st.layer(fx, "fields"):
            fill_polygon(im, draw, ring, st.FIELD_FILL, st.FIELD_EDGE, px(st.W["field_edge"]))
    for ring in st.layer(fx, "peat_production"):
        fill_polygon(im, draw, ring, st.PEAT_FILL)
    for ring in st.layers(fx, "water", "ponds"):
        fill_polygon(im, draw, ring, st.WATER_FILL, st.WATER_SHORE, px(st.W["shore"]))
    for ring in st.layer(fx, "islands"):
        fill_polygon(im, draw, ring, st.BG, st.WATER_SHORE, px(st.W["shore"]))


def obstacles(fx):
    """Points that contour and road labels must not cover, and boxes that names avoid."""
    h = lab.PointHash()
    for k, c in enumerate(fx.get("contours") or []):
        h.add_line(st.polyline_pts(c), tag=("c", k))
    for k, r in enumerate(fx.get("roads") or []):
        h.add_line(st.polyline_pts(r), tag=("r", k))
    for name in ("ditches", "river", "brooks", "streams"):
        for k, ln in enumerate(fx.get(name) or []):
            h.add_line(st.polyline_pts(ln), tag=("w", k), step=4.0)
    h.add_line(fx.get("powerLine") or [], tag=("p", 0))
    boxes = lab.BoxSet()
    for b in fx.get("buildings") or []:
        (x, y), half = b["px"], max(2.0, b.get("size", 3) / 2) + 1
        boxes.add((x - half, y - half, x + half, y + half))
        for dx in (-half, 0, half):
            for dy in (-half, 0, half):
                h.add(x + dx, y + dy)
    for bx, by in fx.get("bridges") or []:
        boxes.add((bx - 8, by - 8, bx + 8, by + 8))
        h.add(bx, by)
    return h, boxes


def plan_line_labels(fx, hash_, taken, elev):
    """Heights for index contours and road numbers; placed once for both languages."""
    contours = fx.get("contours") or []
    lines = []
    for k, c in enumerate(contours):
        pts = st.polyline_pts(c)
        if len(pts) >= 2 and st.contour_is_index(c, INDEX_INTERVAL_M):
            h = lab.contour_height(c, pts, elev, INDEX_INTERVAL_M)
            lines.append((("c", k), pts, None if h is None else f"{h:g}"))
    lines.sort(key=lambda t: (-lab.cumlen(t[1])[-1], t[0]))
    uphill = elev.at if elev.z is not None else None
    contour_labels = lab.place_line_labels(lines, hash_, taken, st.CONTOUR_LABEL_SIZE, uphill=uphill)
    refs = [(("r", k), st.polyline_pts(r), str(r["ref"])) for k, r in enumerate(fx.get("roads") or []) if r.get("ref")]
    road_labels = lab.place_line_labels(refs, hash_, taken, st.ROAD_REF_SIZE, along_gap=1500, min_sep=400)
    return contour_labels, road_labels


def draw_lines(im, draw, fx, contour_labels, name_boxes=()):
    kinds = fx.get("ditchKinds") or []
    for k, d in enumerate(fx.get("ditches") or []):
        kind = d.get("cls") if isinstance(d, dict) else (kinds[k] if k < len(kinds) else None)
        width = st.W["ditch_main" if kind in ("main", "collector") else "ditch"]
        # ditches are knocked out under the names, so a mire name stays legible over its ditch network
        for piece in areas.knock_out(st.polyline_pts(d), name_boxes):
            line(draw, piece, st.STREAM, width)

    gaps = {}
    for tag, _, _, _, span in contour_labels:
        gaps.setdefault(tag[1], []).append(span)
    for k, c in enumerate(fx.get("contours") or []):
        pts = st.polyline_pts(c)
        idx = st.contour_is_index(c, INDEX_INTERVAL_M)
        for piece in lab.cut_polyline(pts, gaps.get(k)):
            if c.get("aux"):  # apukäyrä: the 2.5 m auxiliary contour of flat ground, dashed and thin
                dashed(draw, piece, st.CONTOUR, st.W["contour_aux"], *st.DASH["contour_aux"])
            else:
                line(draw, piece, st.CONTOUR_INDEX if idx else st.CONTOUR, st.W["contour_index" if idx else "contour"])
    fnt = st.font("regular", st.CONTOUR_LABEL_SIZE * SS)
    for _, text, (cx, cy), angle, _ in contour_labels:
        lab.draw_rotated_text(im, text, fnt, (cx * SS, cy * SS), angle, st.CONTOUR_INDEX)

    # rivers drawn as areas between banks (both banks first, so runs join cleanly), then streams
    runs = [st.polyline_pts(r) for r in fx.get("river") or []]
    for r in runs:
        line(draw, r, st.WATER_SHORE, st.W["river_bank"])
    for r in runs:
        line(draw, r, st.WATER_FILL, st.W["river_water"])
    for b in st.layer(fx, "streams", "brooks"):
        line(draw, st.polyline_pts(b), st.STREAM, st.W["brook"])


def draw_roads(draw, fx):
    roads, order = road_classes(fx)
    for cls in order:
        colour = st.ROAD_COLOUR.get(cls, st.ROAD_BLACK)
        width = st.W.get(cls, 1.0)
        for r in roads:
            if r.get("cls") != cls:
                continue
            pts = st.polyline_pts(r)
            if cls in st.DASH:
                dashed(draw, pts, colour, width, *st.DASH[cls])
            else:
                line(draw, pts, colour, width)
                if cls in st.CASED:
                    line(draw, pts, st.ROAD_CASED_CORE, width * st.CASED[cls])


def draw_power_line(draw, fx):
    """sähkölinja: a thin dark line with a short cross tick every 100 m."""
    pl = fx.get("powerLine") or []
    if len(pl) < 2:
        return
    line(draw, pl, st.POWERLINE, st.W["power"])
    step = 100 / fx.get("metresPerPixel", 4)
    cum = lab.cumlen(pl)
    s = step
    while s < cum[-1]:
        (x, y), i = lab.point_at(pl, cum, s)
        a, b = pl[i], pl[min(i + 1, len(pl) - 1)]
        d = math.hypot(b[0] - a[0], b[1] - a[1]) or 1.0
        nx, ny = -(b[1] - a[1]) / d * 3, (b[0] - a[0]) / d * 3
        draw.line(sc([(x - nx, y - ny), (x + nx, y + ny)]), fill=st.POWERLINE, width=px(st.W["power"]))
        s += step


def road_direction(fx, x, y):
    """Unit direction and class of the road segment nearest to (x, y)."""
    best = None
    for r in fx.get("roads") or []:
        pts = st.polyline_pts(r)
        for a, b in zip(pts, pts[1:]):
            vx, vy = b[0] - a[0], b[1] - a[1]
            L2 = vx * vx + vy * vy
            if L2 == 0:
                continue
            t = min(1, max(0, ((x - a[0]) * vx + (y - a[1]) * vy) / L2))
            d = math.hypot(a[0] + vx * t - x, a[1] + vy * t - y)
            if best is None or d < best[0]:
                L = math.sqrt(L2)
                best = (d, (vx / L, vy / L), r.get("cls"))
    return best


def draw_bridges(draw, fx, key="bridges", half=8, flare=2, gap=2, width_key="bridge"):
    """A bridge: two black side lines along the road, with flared ends. Culverts (key="culverts") get the same
    sign, short and close to the road, where a brook or main ditch passes under it."""
    for bx, by in fx.get(key) or []:
        nearest = road_direction(fx, bx, by)
        ux, uy = nearest[1] if nearest and nearest[0] < 12 else (1.0, 0.0)
        nx, ny = -uy, ux
        off = st.W.get(nearest[2] if nearest else "main", 2.5) / 2 + gap
        for side in (-1, 1):
            ox, oy = bx + nx * off * side, by + ny * off * side
            p0, p1 = (ox - ux * half, oy - uy * half), (ox + ux * half, oy + uy * half)
            flare0 = (p0[0] - ux * flare + nx * flare * side, p0[1] - uy * flare + ny * flare * side)
            flare1 = (p1[0] + ux * flare + nx * flare * side, p1[1] + uy * flare + ny * flare * side)
            draw.line(sc([flare0, p0, p1, flare1]), fill=st.ROAD_BLACK, width=px(st.W[width_key]))


def draw_buildings(draw, fx):
    for b in fx.get("buildings") or []:
        cx, cy = b["px"]
        half = max(2.0, b.get("size", 3) / 2)
        if b.get("kind") == "other":
            half = max(1.5, half * 0.8)  # saunas, barns, huts: a smaller square
        draw.rectangle([(cx - half) * SS, (cy - half) * SS, (cx + half) * SS, (cy + half) * SS], fill=st.BUILDING)


def main():
    fx = load_features()
    size = fx["size"]
    elev = lab.Elevation(fx)

    # Names first (both languages), so the contour labels can keep clear of either.
    hash_, building_boxes = obstacles(fx)
    placed = {lang: lab.place_point_labels(fx.get(key) or [], building_boxes, hash_)
              for lang, key in (("fi", "labels"), ("en", "labelsEn"))}
    taken = lab.BoxSet()
    for b in building_boxes.boxes:
        taken.add(b)
    for lang in placed:
        for *_, box in placed[lang]:
            taken.add(box)
    contour_labels, road_labels = plan_line_labels(fx, hash_, taken, elev)
    name_boxes = [box for lang in placed for lb, _, _, box in placed[lang] if lb["style"] != "height"]

    im = Image.new("RGB", (size * SS, size * SS), st.BG)
    draw = ImageDraw.Draw(im)
    draw_ground(im, draw, fx)
    draw_lines(im, draw, fx, contour_labels, name_boxes)
    draw_roads(draw, fx)
    draw_power_line(draw, fx)
    draw_bridges(draw, fx)
    draw_bridges(draw, fx, "culverts", half=2.5, flare=1.2, gap=1.2, width_key="culvert")
    draw_buildings(draw, fx)
    ref_font = st.font("regular", st.ROAD_REF_SIZE * SS)
    for _, text, (cx, cy), angle, _ in road_labels:
        lab.draw_rotated_text(im, text, ref_font, (cx * SS, cy * SS), angle, st.ROAD_REF, st.HALO, SS)
    print(f"  {len(contour_labels)} contour labels, {len(road_labels)} road numbers")

    base = im
    for lang, full_path, tile_dir_name in (("fi", OUT_PATH, "topo"), ("en", None, "topo-en")):
        im = base.copy()
        lab.draw_point_labels(ImageDraw.Draw(im), placed[lang], SS)
        im = im.resize((size, size), Image.LANCZOS)
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        # WebP q90 (the PNG froze the browser while decoding, 24 Sep 2026). English: tiles only, all the UI loads.
        if full_path:
            im.save(full_path, quality=90, method=4)
        step = size // TILES
        tile_dir = os.path.join(os.path.dirname(OUT_PATH), tile_dir_name)
        os.makedirs(tile_dir, exist_ok=True)
        for r in range(TILES):
            for c in range(TILES):
                im.crop((c * step, r * step, (c + 1) * step, (r + 1) * step)).save(
                    os.path.join(tile_dir, f"{r}_{c}.webp"), quality=90, method=4)
        print(f"wrote {full_path or tile_dir} ({size}x{size})")


if __name__ == "__main__":
    main()
