"""
Style for the basemap drawn by `render.py`: the palette, line widths, fonts and the layer accessors.

Palette: SPEC/33 §9, sampled from the researcher's Karttapaikka maastokartta screenshots
(`docs/audits/2026-10-20-map/reference/`, © Maanmittauslaitos, CC BY 4.0). Colours that §9 names are used
exactly; the rest (lake cyan, the blues, the clearing tone) were sampled from the same screenshots on
20 Oct 2026. Line widths and type sizes are final-image pixels on the 4 m/px map: the screenshots are at
3.5–5.4 m/px, so their widths carry over almost one to one.

The layer accessors make the renderer data-driven: every layer is optional, and the names the terrain
rebuild (SPEC/33 §4 stages 1–5) will write are read beside today's names.
"""

import os

from PIL import ImageFont


def rgb(hex_colour):
    h = hex_colour.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# Palette (SPEC/33 §9)
# ---------------------------------------------------------------------------
BG = rgb("#f8f8f8")  # forest and other land: white
FIELD_FILL = rgb("#fcd878")  # pelto
FIELD_EDGE = rgb("#f8d078")  # the field's darker edge (§9)
MIRE_FILL = rgb("#c0e8e8")  # mire and paludified ground, one fill; drained mires carry their ditches
PEAT_FILL = rgb("#cccc3c")  # turvetuotantoalue (peat production), olive
ROCK_FILL = rgb("#d0c8d0")  # avokallio, lavender-grey
CONTOUR = rgb("#b48454")  # 5 m contour
CONTOUR_INDEX = rgb("#9c6c3c")  # index contour, darker, labelled with its height
WATER_FILL = rgb("#80ffff")  # lakes: cyan (sampled from the screenshots)
WATER_SHORE = rgb("#0071bb")  # shore line and river banks (MML rantaviiva)
STREAM = rgb("#1a86dc")  # streams and ditches: the screenshots' thin blue lines
ROAD_RED = rgb("#c00000")  # MML public-road red: NOT drawn in the study (SPEC/12 reserves red for the live fire; SPEC/33 §9 (ba))
ROAD_CASED_CORE = rgb("#fff4d6")  # public roads: a light core inside a black casing (SPEC/33 §9 (ba))
ROAD_BLACK = rgb("#141414")  # private and forest roads, tracks, paths
ROAD_REF = rgb("#e000e0")  # road numbers in magenta (drawn only when a road carries "ref")
BUILDING = rgb("#000000")  # houses: small black squares
POWERLINE = rgb("#282828")
CLEARED_FILL = rgb("#fff2d0")  # the 110 kV corridor and the log landing: open ground, not field
CLEARED_EDGE = rgb("#a09078")
LABEL_BLACK = rgb("#111111")
LABEL_WATER = rgb("#0060b0")  # water names: blue italic (a shade darker than the shore, for contrast on cyan)
HALO = (255, 255, 255)

# ---------------------------------------------------------------------------
# Line widths and symbol sizes, final px (render.py multiplies by its supersample factor)
# ---------------------------------------------------------------------------
W = {
    "contour": 1.5, "contour_index": 2.5, "ditch": 1.0, "ditch_main": 1.5, "brook": 1.5,
    "river_bank": 5.0, "river_water": 3.0, "shore": 1.0, "field_edge": 1.0,
    "main": 3.5, "gravel": 2.5, "public": 2.5, "forest": 2.0, "private": 2.0,
    "track": 1.5, "path": 1.0, "power": 1.0, "bridge": 1.5,
}
# Dashes (on, off) in final px: ajopolku (track) and polku (path), as in the screenshots.
DASH = {"track": (9, 4), "path": (5, 3)}
ROAD_COLOUR = {"main": ROAD_BLACK, "gravel": ROAD_BLACK, "public": ROAD_BLACK,
               "forest": ROAD_BLACK, "private": ROAD_BLACK, "track": ROAD_BLACK, "path": ROAD_BLACK}
# Public roads are cased (black casing at the class width, a light core at about half of it), so no road is red.
CASED = {"main": 0.5, "gravel": 0.42, "public": 0.42}
# Drawing order, minor classes first; unknown classes are drawn as thin black lines before these.
ROAD_ORDER = ("path", "track", "forest", "private", "gravel", "public", "main")

# ---------------------------------------------------------------------------
# Type (SPEC/33 §9): villages bold, farms regular, terrain and mire names italic, water blue italic.
# All sans, as on the maastokartta.
# ---------------------------------------------------------------------------
LABEL_STYLE = {
    # style: (face, size px, colour)
    "village": ("bold", 24, LABEL_BLACK),
    "place": ("regular", 17, LABEL_BLACK),
    "terrain": ("italic", 17, LABEL_BLACK),
    "bog": ("italic", 17, LABEL_BLACK),
    "water": ("italic", 17, LABEL_WATER),
    "height": ("regular", 12, LABEL_BLACK),
}
CONTOUR_LABEL_SIZE = 12
ROAD_REF_SIZE = 12
# Placement priority: higher-priority labels are placed first and keep their designed point.
LABEL_PRIORITY = {"village": 0, "place": 1, "water": 2, "bog": 3, "terrain": 3, "height": 5}

_FACES = {
    # Windows (the researcher's machine) first, then the metric-compatible Liberation and DejaVu faces.
    "regular": ("arial.ttf", "LiberationSans-Regular.ttf", "DejaVuSans.ttf"),
    "bold": ("arialbd.ttf", "LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"),
    "italic": ("ariali.ttf", "LiberationSans-Italic.ttf", "DejaVuSans-Oblique.ttf"),
}
_FONT_DIRS = (
    os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts"),
    "/usr/share/fonts/truetype/liberation",
    "/usr/share/fonts/truetype/liberation2",
    "/usr/share/fonts/truetype/dejavu",
    "/Library/Fonts",
)
_font_cache = {}


def font(face, size):
    key = (face, size)
    if key not in _font_cache:
        f = None
        for name in _FACES[face]:
            for d in _FONT_DIRS:
                try:
                    f = ImageFont.truetype(os.path.join(d, name), size)
                    break
                except OSError:
                    continue
            if f:
                break
        _font_cache[key] = f or ImageFont.load_default(size)
    return _font_cache[key]


# ---------------------------------------------------------------------------
# Layer accessors. Each returns [] when the layer is absent, so any layer may be missing.
# ---------------------------------------------------------------------------
def layer(fx, *names):
    """The first non-empty layer among `names` (a new name first, today's name as the fallback)."""
    for n in names:
        v = fx.get(n)
        if v:
            return v
    return []


def layers(fx, *names):
    """All of `names` concatenated (layers with the same symbol, e.g. every mire type)."""
    out = []
    for n in names:
        out.extend(fx.get(n) or [])
    return out


def is_point(p):
    return isinstance(p, (list, tuple)) and len(p) >= 2 and isinstance(p[0], (int, float))


def polygon_rings(item):
    """A polygon as [outer, hole, ...]: accepts a ring, {"pts"|"ring": ring}, {"rings": [...]} or [ring, ...]."""
    if isinstance(item, dict):
        if "rings" in item:
            return [r for r in item["rings"] if len(r) >= 3]
        item = item.get("pts") or item.get("ring") or []
    if item and is_point(item[0]):
        return [item] if len(item) >= 3 else []
    return [r for r in item if len(r) >= 3]


def polyline_pts(item):
    """A polyline's points: accepts a list of points or {"pts": [...]}."""
    if isinstance(item, dict):
        return item.get("pts") or []
    return item


def contour_is_index(c, interval):
    """Index contour: the feature's own flag ("contours_index" or "index"), else its level on the index interval."""
    for k in ("contours_index", "index"):
        if k in c:
            return bool(c[k])
    level = contour_level(c)
    return level is not None and interval and level % interval == 0


def contour_level(c):
    for k in ("level", "elev", "h", "z"):
        if isinstance(c.get(k), (int, float)):
            return c[k]
    return None
