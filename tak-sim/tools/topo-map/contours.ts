/**
 * Contours by marching squares on an n × n elevation grid (cell centres at `cellX(c)`, `cellY(r)`), chained into polylines:
 * 5 m pääkäyrät (every 20 m an index contour) and, on flat ground, 2.5 m apukäyrät (SPEC/33 §2.3) — kept only where the ground
 * between two 5 m contours is wide and flat enough that the auxiliary adds information.
 */

export interface Contour { readonly level: number; readonly index: boolean; readonly aux: boolean; readonly pts: [number, number][] }

export function traceContours(
  elev: Float32Array, water: Uint8Array, n: number, cellX: (c: number) => number, cellY: (r: number) => number,
  toPx: (x: number, y: number) => [number, number], levels: readonly number[], isAux: (level: number) => boolean,
): Contour[] {
  const out: Contour[] = [];
  const H = n * n;
  for (const level of levels) {
    const pointOnEdge = (edge: number): [number, number] => {
      let x0: number, y0: number, x1: number, y1: number, e0: number, e1: number;
      if (edge < H) {
        const r = Math.floor(edge / n);
        const c = edge % n;
        x0 = cellX(c); y0 = cellY(r); x1 = cellX(c + 1); y1 = y0; e0 = elev[r * n + c]!; e1 = elev[r * n + c + 1]!;
      } else {
        const e = edge - H;
        const r = Math.floor(e / n);
        const c = e % n;
        x0 = cellX(c); y0 = cellY(r); x1 = x0; y1 = cellY(r + 1); e0 = elev[r * n + c]!; e1 = elev[(r + 1) * n + c]!;
      }
      const t = e1 === e0 ? 0.5 : (level - e0) / (e1 - e0);
      return toPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    };
    const segA: number[] = [];
    const segB: number[] = [];
    for (let r = 0; r + 1 < n; r++) {
      for (let c = 0; c + 1 < n; c++) {
        const i = r * n + c;
        if (water[i] && water[i + 1] && water[i + n] && water[i + n + 1]) continue;
        const bl = elev[i]! >= level ? 1 : 0;
        const br = elev[i + 1]! >= level ? 1 : 0;
        const tr = elev[i + n + 1]! >= level ? 1 : 0;
        const tl = elev[i + n]! >= level ? 1 : 0;
        const code = bl | (br << 1) | (tr << 2) | (tl << 3);
        if (code === 0 || code === 15) continue;
        const bottom = r * n + c;
        const top = (r + 1) * n + c;
        const left = H + r * n + c;
        const right = H + r * n + c + 1;
        const add = (a: number, b: number) => { segA.push(a); segB.push(b); };
        switch (code) {
          case 1: case 14: add(left, bottom); break;
          case 2: case 13: add(bottom, right); break;
          case 3: case 12: add(left, right); break;
          case 4: case 11: add(right, top); break;
          case 6: case 9: add(bottom, top); break;
          case 7: case 8: add(left, top); break;
          case 5: case 10: {
            const centre = (elev[i]! + elev[i + 1]! + elev[i + n]! + elev[i + n + 1]!) / 4 >= level ? 1 : 0;
            if ((code === 5) === (centre === 1)) { add(left, top); add(bottom, right); } else { add(left, bottom); add(right, top); }
            break;
          }
          default: break;
        }
      }
    }
    const byEdge = new Map<number, number[]>();
    for (let s = 0; s < segA.length; s++) {
      for (const e of [segA[s]!, segB[s]!]) {
        const list = byEdge.get(e);
        if (list) list.push(s); else byEdge.set(e, [s]);
      }
    }
    const used = new Uint8Array(segA.length);
    const aux = isAux(level);
    for (let s0 = 0; s0 < segA.length; s0++) {
      if (used[s0]) continue;
      used[s0] = 1;
      const chain: number[] = [segA[s0]!, segB[s0]!];
      for (const dir of [1, -1]) {
        for (;;) {
          const endEdge = dir === 1 ? chain[chain.length - 1]! : chain[0]!;
          const next = (byEdge.get(endEdge) ?? []).find((s) => !used[s]);
          if (next === undefined) break;
          used[next] = 1;
          const other = segA[next] === endEdge ? segB[next]! : segA[next]!;
          if (dir === 1) chain.push(other); else chain.unshift(other);
        }
      }
      if (chain.length < (aux ? 12 : 4)) continue;
      const pts = chain.map(pointOnEdge);
      // Thin to every other point on long lines; the renderer smooths.
      const thin = pts.filter((_, k) => k % 2 === 0 || k === pts.length - 1);
      out.push({ level, index: !aux && level % 20 === 0, aux, pts: thin });
    }
  }
  return out;
}

/**
 * Keeps an auxiliary contour only where the ground is flat: at least 80 % of its points lie where `flatAt` holds (in practice a
 * slope under ~2 %, where the 5 m contours are far apart).
 */
export function keepFlatAux(contours: readonly Contour[], flatAt: (px: [number, number]) => boolean): Contour[] {
  return contours.filter((c) => !c.aux || c.pts.filter(flatAt).length >= c.pts.length * 0.8);
}
