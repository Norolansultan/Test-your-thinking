"""
Area and line helpers for `render.py`: field blocks drawn as one fill per block, and line work knocked out under names.

Field blocks (SPEC/33 §9, "fields are irregular-rectilinear blocks"): the build's parcels are rectangles 8 m apart (the
headland between strips). On the maastokartta a field block is one plain `#fcd878` area with a slightly darker edge; the parcel
strips inside it are not drawn. So each parcel is grown by a pixel to close the headlands, the parcels of a block are filled as
one mask, and only the block's outer edge is drawn: the result is a few irregular-rectilinear blocks, not uniform strips.

Coordinates are final-image pixels; `ss` is render.py's supersample factor. Deterministic: fixed orders throughout.
"""

import math

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def _grow_ring(ring, g):
    """A convex ring (a parcel rectangle) grown by g px along both of its axes at every corner."""
    n = len(ring)
    out = []
    for i in range(n):
        p, a, b = ring[i], ring[i - 1], ring[(i + 1) % n]
        da = math.hypot(p[0] - a[0], p[1] - a[1]) or 1.0
        db = math.hypot(p[0] - b[0], p[1] - b[1]) or 1.0
        out.append((p[0] + g * ((p[0] - a[0]) / da + (p[0] - b[0]) / db),
                    p[1] + g * ((p[1] - a[1]) / da + (p[1] - b[1]) / db)))
    return out


def _groups(boxes, pad):
    """Indices of boxes grouped by overlap (union-find), in a fixed order."""
    parent = list(range(len(boxes)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    order = sorted(range(len(boxes)), key=lambda i: (boxes[i][0], boxes[i][1], i))
    for k, i in enumerate(order):
        bi = boxes[i]
        for j in order[k + 1:]:
            bj = boxes[j]
            if bj[0] > bi[2] + pad:
                break
            if bj[1] <= bi[3] + pad and bi[1] <= bj[3] + pad:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[max(ri, rj)] = min(ri, rj)
    groups = {}
    for i in range(len(boxes)):
        groups.setdefault(find(i), []).append(i)
    return [groups[k] for k in sorted(groups)]


def draw_field_blocks(im, rings, ss, fill, edge, edge_px=1.0, grow_px=1.2):
    """Fills the parcels as blocks (headlands closed) and outlines each block's outer edge only."""
    grown = [_grow_ring([tuple(p) for p in r], grow_px) for r in rings if len(r) >= 3]
    if not grown:
        return
    boxes = [(min(p[0] for p in r), min(p[1] for p in r), max(p[0] for p in r), max(p[1] for p in r)) for r in grown]
    k = max(3, 2 * int(round(edge_px * ss)) + 1)  # erosion window: the edge is edge_px wide
    for idx in _groups(boxes, 2.0):
        x0 = int(math.floor(min(boxes[i][0] for i in idx))) - 3
        y0 = int(math.floor(min(boxes[i][1] for i in idx))) - 3
        x1 = int(math.ceil(max(boxes[i][2] for i in idx))) + 3
        y1 = int(math.ceil(max(boxes[i][3] for i in idx))) + 3
        mask = Image.new("L", ((x1 - x0) * ss, (y1 - y0) * ss), 0)
        md = ImageDraw.Draw(mask)
        for i in idx:
            md.polygon([((x - x0) * ss, (y - y0) * ss) for x, y in grown[i]], fill=255)
        rim = ImageChops.subtract(mask, mask.filter(ImageFilter.MinFilter(k)))
        box = (x0 * ss, y0 * ss, x1 * ss, y1 * ss)
        im.paste(fill, box, mask)
        im.paste(edge, box, rim)


def _inside_interval(a, b, box):
    """Liang–Barsky: the parameter interval [t0, t1] of segment a→b inside the box, or None."""
    t0, t1 = 0.0, 1.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - box[0]), (dx, box[2] - a[0]), (-dy, a[1] - box[1]), (dy, box[3] - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return None
    return (t0, t1)


def knock_out(pts, boxes):
    """The polyline with the parts inside any of `boxes` removed: a list of pieces (names stay legible over ditches)."""
    if len(pts) < 2 or not boxes:
        return [pts]
    pieces, cur = [], [tuple(pts[0])]
    for a, b in zip(pts, pts[1:]):
        sx0, sx1 = min(a[0], b[0]), max(a[0], b[0])
        sy0, sy1 = min(a[1], b[1]), max(a[1], b[1])
        cuts = []
        for bx in boxes:
            if bx[0] > sx1 or bx[2] < sx0 or bx[1] > sy1 or bx[3] < sy0:
                continue
            iv = _inside_interval(a, b, bx)
            if iv and iv[1] > iv[0]:
                cuts.append(iv)
        if not cuts:
            cur.append(tuple(b))
            continue
        cuts.sort()
        t = 0.0
        for c0, c1 in cuts:
            if c0 > t:
                cur.append((a[0] + (b[0] - a[0]) * c0, a[1] + (b[1] - a[1]) * c0))
            if len(cur) >= 2:
                pieces.append(cur)
            t = max(t, c1)
            cur = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)]
        if t < 1.0:
            cur.append(tuple(b))
    if len(cur) >= 2:
        pieces.append(cur)
    return pieces
