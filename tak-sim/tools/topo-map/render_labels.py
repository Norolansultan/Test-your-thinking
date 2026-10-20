"""
Label placement for `render.py`: point names and spot heights without overlaps, and the height labels
set into index contours (and road numbers, when roads carry a "ref").

Coordinates here are final-image pixels; render.py scales them by its supersample factor when drawing.
Everything is deterministic: candidates are tried in a fixed order, contours in a fixed order.
"""

import math

import numpy as np
from PIL import Image, ImageDraw

import render_style as st


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------
def cumlen(pts):
    out = [0.0]
    for a, b in zip(pts, pts[1:]):
        out.append(out[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return out


def point_at(pts, cum, s):
    """The point at arc length s, and the index of the segment it lies on."""
    s = min(max(s, 0.0), cum[-1])
    lo, hi = 0, len(cum) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if cum[mid] <= s:
            lo = mid
        else:
            hi = mid
    seg = cum[hi] - cum[lo]
    t = 0.0 if seg == 0 else (s - cum[lo]) / seg
    a, b = pts[lo], pts[hi]
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), lo


def sub_polyline(pts, cum, s0, s1):
    """The part of the polyline between arc lengths s0 < s1."""
    p0, i0 = point_at(pts, cum, s0)
    p1, i1 = point_at(pts, cum, s1)
    return [p0] + [tuple(p) for p in pts[i0 + 1:i1 + 1]] + [p1]


def cut_polyline(pts, gaps):
    """The polyline with the arc-length intervals in `gaps` left out (gaps for labels set into the line)."""
    if not gaps:
        return [pts]
    cum = cumlen(pts)
    keep, s = [], 0.0
    for g0, g1 in sorted(gaps):
        if g0 > s:
            keep.append((s, g0))
        s = max(s, g1)
    if s < cum[-1]:
        keep.append((s, cum[-1]))
    return [sub_polyline(pts, cum, a, b) for a, b in keep if b - a > 0.5]


def resample(pts, step):
    """Points every `step` px along the polyline, with their arc length."""
    out = []
    cum = cumlen(pts)
    if cum[-1] == 0:
        return [(pts[0][0], pts[0][1], 0.0)]
    n = max(1, int(cum[-1] // step))
    for k in range(n + 1):
        p, _ = point_at(pts, cum, k * cum[-1] / n)
        out.append((p[0], p[1], k * cum[-1] / n))
    return out


# ---------------------------------------------------------------------------
# Spatial indexes
# ---------------------------------------------------------------------------
class PointHash:
    """Obstacle points (lines resampled, building corners), each tagged (owner, arc length)."""

    def __init__(self, cell=24):
        self.cell, self.cells = cell, {}

    def add(self, x, y, tag=None):
        self.cells.setdefault((int(x // self.cell), int(y // self.cell)), []).append((x, y, tag))

    def add_line(self, pts, tag=None, step=3.0):
        if len(pts) >= 2:
            for x, y, s in resample(pts, step):
                self.add(x, y, (tag, s))

    def near(self, x0, y0, x1, y1):
        c = self.cell
        for i in range(int(x0 // c), int(x1 // c) + 1):
            for j in range(int(y0 // c), int(y1 // c) + 1):
                yield from self.cells.get((i, j), ())


class BoxSet:
    """Axis-aligned boxes already taken (labels, buildings)."""

    def __init__(self):
        self.boxes = []

    def hits(self, b):
        return sum(1 for o in self.boxes if b[0] < o[2] and o[0] < b[2] and b[1] < o[3] and o[1] < b[3])

    def add(self, b):
        self.boxes.append(b)


# ---------------------------------------------------------------------------
# Point labels: names and spot heights
# ---------------------------------------------------------------------------
# Name candidates (anchor, dx, dy), dx and dy in units of the type size: the designed point first, then
# small shifts, then a line above or below.
NAME_CANDIDATES = (("lm", 0, 0), ("lm", 0.5, 0), ("lm", -0.5, 0), ("lm", 0, -1), ("lm", 0, 1), ("rm", -0.3, 0),
                   ("mb", 0, -0.6), ("mt", 0, 0.6), ("lm", 0.5, -1), ("lm", 0.5, 1), ("lm", -1, -1), ("lm", -1, 1),
                   ("lm", 0, -2), ("lm", 0, 2))
HEIGHT_CANDIDATES = (("lt", 3, 2), ("lb", 3, -2), ("rt", -3, 2), ("rb", -3, -2), ("mt", 0, 3), ("mb", 0, -3),
                     ("lm", 4, 0), ("rm", -4, 0))


def text_box(text, fnt, x, y, anchor, pad=3.0):
    b = fnt.getbbox(text, anchor=anchor)
    return (x + b[0] - pad, y + b[1] - pad, x + b[2] + pad, y + b[3] + pad)


def line_cost(hash_, box):
    """How much line work a label box would cover: roads and the power line count fully, contours and water
    lines a little (names on a mire always sit on its ditches)."""
    if hash_ is None:
        return 0.0
    cost = 0.0
    for x, y, t in hash_.near(*box):
        if box[0] <= x <= box[2] and box[1] <= y <= box[3]:
            kind = t[0][0] if t and t[0] else None
            cost += 1.0 if kind in ("r", "p") else 0.05
    return cost


def place_point_labels(labels, obstacles, hash_=None):
    """Each label's position: its designed point if free, else the first free candidate, else the least
    crowded one (other labels and houses weigh most, then roads). Nothing is dropped.
    Returns [(label, (x, y), anchor, box)] in drawing order."""
    order = sorted(range(len(labels)), key=lambda i: (st.LABEL_PRIORITY.get(labels[i]["style"], 4), i))
    taken = BoxSet()
    for b in obstacles.boxes:
        taken.add(b)
    out = []
    for i in order:
        lb = labels[i]
        face, size, _ = st.LABEL_STYLE.get(lb["style"], st.LABEL_STYLE["place"])
        fnt = st.font(face, size)
        x, y = lb["px"]
        cands = HEIGHT_CANDIDATES if lb["style"] == "height" else NAME_CANDIDATES
        best = None
        for anchor, dx, dy in cands:
            if lb["style"] != "height":
                dx, dy = dx * size, dy * size
            px, py = x + dx, y + dy
            box = text_box(lb["text"], fnt, px, py, anchor)
            score = 100 * taken.hits(box) + line_cost(hash_, box)
            if best is None or score < best[0] - 0.5:
                best = (score, (px, py), anchor, box)
            if score < 0.5:
                break
        if best[0] >= 0.5 and lb["style"] != "height":
            # No listed candidate is clear: search a grid of nearby points (quarter-line steps, out to two and a
            # half lines), nearest first, and take the clearest; distance from the designed point costs a little.
            steps = [k / 4 for k in range(-10, 11)]
            for dx, dy in sorted(((a, b) for a in steps for b in steps), key=lambda d: (math.hypot(*d), d)):
                box = text_box(lb["text"], fnt, x + dx * size, y + dy * size, "lm")
                score = 100 * taken.hits(box) + line_cost(hash_, box) + 0.3 * math.hypot(dx, dy)
                if score < best[0] - 0.5:
                    best = (score, (x + dx * size, y + dy * size), "lm", box)
        taken.add(best[3])
        out.append((lb, best[1], best[2], best[3]))
    return out


def draw_point_labels(draw, placed, ss):
    for lb, (x, y), anchor, _ in placed:
        face, size, colour = st.LABEL_STYLE.get(lb["style"], st.LABEL_STYLE["place"])
        if lb["style"] == "height":
            hx, hy = lb["px"]
            r = 1.5 * ss
            draw.ellipse([hx * ss - r, hy * ss - r, hx * ss + r, hy * ss + r], fill=colour)
        draw.text((x * ss, y * ss), lb["text"], font=st.font(face, size * ss), fill=colour,
                  stroke_width=max(1, ss), stroke_fill=st.HALO, anchor=anchor)


# ---------------------------------------------------------------------------
# Labels along lines: index-contour heights (uphill-up, as on the maastokartta) and road numbers
# ---------------------------------------------------------------------------
class Elevation:
    """The build's elevation grid, sampled in map pixels. The grid's row 0 is the SOUTH edge (build.ts
    samples `cellY(r)` from -HALF upward), so it is flipped here to image order (row 0 = north)."""

    def __init__(self, fx):
        g = fx.get("elevationGrid")
        self.z = None
        if g and g.get("values"):
            n = g["size"]
            self.z = np.asarray(g["values"], dtype=np.float32).reshape(n, n)[::-1]
            self.k = n / fx["size"]

    def at(self, x, y):
        n = self.z.shape[0]
        gx = min(max(x * self.k, 0.0), n - 1.001)
        gy = min(max(y * self.k, 0.0), n - 1.001)
        i, j = int(gy), int(gx)
        fy, fx_ = gy - i, gx - j
        z = self.z
        return float(z[i, j] * (1 - fx_) * (1 - fy) + z[i, j + 1] * fx_ * (1 - fy)
                     + z[i + 1, j] * (1 - fx_) * fy + z[i + 1, j + 1] * fx_ * fy)


def contour_height(c, pts, elev, index_interval):
    """The contour's height: its own "level" if the build wrote one; else the grid's median along it, snapped
    to the index interval and used only when it is within 3 m of it (never a wrong label)."""
    lv = st.contour_level(c)
    if lv is not None:
        return lv
    if elev.z is None:
        return None
    m = float(np.median([elev.at(x, y) for x, y in pts[::max(1, len(pts) // 40)]]))
    snapped = index_interval * round(m / index_interval)
    return snapped if abs(m - snapped) <= 3.0 else None


def _fits(pts, cum, s, half, hash_, tag, half_h, max_turn_deg=22):
    """Centre, unit tangent and rotated box of a label at arc length s, or None if the line bends or the box
    holds an obstacle point (other lines, roads, ditches, houses)."""
    (cx, cy), _ = point_at(pts, cum, s)
    pa, _ = point_at(pts, cum, s - half)
    pb, _ = point_at(pts, cum, s + half)
    ux, uy = pb[0] - pa[0], pb[1] - pa[1]
    d = math.hypot(ux, uy)
    if d < 1.6 * half:  # the chord is much shorter than the arc: the line bends under the label
        return None
    ux, uy = ux / d, uy / d
    for sa, sb in ((s - half, s), (s, s + half)):
        qa, _ = point_at(pts, cum, sa)
        qb, _ = point_at(pts, cum, sb)
        vx, vy = qb[0] - qa[0], qb[1] - qa[1]
        vd = math.hypot(vx, vy) or 1.0
        if (vx * ux + vy * uy) / vd < math.cos(math.radians(max_turn_deg)):
            return None
    nx, ny = -uy, ux
    ex = abs(ux) * half + abs(nx) * half_h
    ey = abs(uy) * half + abs(ny) * half_h
    for x, y, t in hash_.near(cx - ex, cy - ey, cx + ex, cy + ey):
        if t is not None and t[0] == tag and abs(t[1] - s) < half + 6:
            continue
        dx, dy = x - cx, y - cy
        if abs(dx * ux + dy * uy) <= half and abs(dx * nx + dy * ny) <= half_h:
            return None
    return (cx, cy), (ux, uy), (cx - ex, cy - ey, cx + ex, cy + ey)


def place_line_labels(lines, hash_, taken, size, min_len_extra=40, along_gap=700, min_sep=220,
                      uphill=None, step=24):
    """lines: [(tag, pts, text)]. Returns [(tag, text, centre, angle_deg, (s0, s1))]: one label every
    `along_gap` px on a line, `min_sep` px from every other line label, on straight runs only."""
    fnt = st.font("regular", size)
    placed, centres = [], []
    for tag, pts, text in lines:
        if text is None or len(pts) < 2:
            continue
        b = fnt.getbbox(text)
        half = (b[2] - b[0]) / 2 + 2
        half_h = (b[3] - b[1]) / 2 + 2
        cum = cumlen(pts)
        if cum[-1] < 2 * half + min_len_extra:
            continue
        last = -1e9
        s = half + min_len_extra / 2
        while s < cum[-1] - half - min_len_extra / 2:
            if s - last < along_gap:
                s += step
                continue
            fit = _fits(pts, cum, s, half, hash_, tag, half_h)
            if fit and not taken.hits(fit[2]) and all(math.hypot(fit[0][0] - a, fit[0][1] - b2) >= min_sep
                                                      for a, b2 in centres):
                (cx, cy), (ux, uy), box = fit
                if uphill is not None:
                    # the text's top (uy, -ux) faces uphill
                    upx, upy = uy, -ux
                    if uphill(cx + upx * 10, cy + upy * 10) < uphill(cx - upx * 10, cy - upy * 10):
                        ux, uy = -ux, -uy
                elif ux < 0 or (ux == 0 and uy > 0):
                    ux, uy = -ux, -uy  # readable: left to right
                taken.add(box)
                centres.append((cx, cy))
                placed.append((tag, text, (cx, cy), -math.degrees(math.atan2(uy, ux)), (s - half - 1, s + half + 1)))
                last = s
            s += step
    return placed


def draw_rotated_text(im, text, fnt, centre, angle, fill, halo=None, halo_w=0):
    b = fnt.getbbox(text)
    pad = 4 + halo_w
    w, h = b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad
    layers_ = ([(halo, halo_w)] if halo else []) + [(fill, 0)]
    for colour, sw in layers_:
        mask = Image.new("L", (int(w), int(h)), 0)
        ImageDraw.Draw(mask).text((pad - b[0], pad - b[1]), text, font=fnt, fill=255, stroke_width=sw, stroke_fill=255)
        mask = mask.rotate(angle, resample=Image.BICUBIC, expand=True)
        x0 = int(round(centre[0] - mask.width / 2))
        y0 = int(round(centre[1] - mask.height / 2))
        im.paste(colour, (x0, y0, x0 + mask.width, y0 + mask.height), mask)
