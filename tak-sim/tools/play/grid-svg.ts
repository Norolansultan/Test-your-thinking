/**
 * The play harness's pixel grid over a map image (revision (bp), 26 Oct 2026; play-test B12): lines every `step` PNG pixels over the map
 * (`width` × `height` at `margin` from the image's edge), every second one labelled with its own PNG coordinate in the margin, as
 * `freezeSvg` labels the freeze map. A point read off the labels is a pixel of the image itself. Pure; drawn in the page over the
 * training's live map (`map-page.ts`).
 */

export function gridSvg(width: number, height: number, margin: number, step: number): string {
  const W = width + 2 * margin, H = height + 2 * margin;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;pointer-events:none">`];
  for (let v = margin + step - (margin % step); v <= margin + Math.max(width, height); v += step) {
    const major = v % (2 * step) === 0;
    const style = `stroke="#1c1b19" stroke-opacity="${major ? 0.55 : 0.25}" stroke-width="${major ? 1 : 0.7}"`;
    if (v <= margin + width) out.push(`<line x1="${v}" y1="${margin}" x2="${v}" y2="${margin + height}" ${style}/>`, ...(major ? [`<text x="${v}" y="${margin - 8}" font-size="12" text-anchor="middle" fill="#1c1b19">${v}</text>`, `<text x="${v}" y="${margin + height + 18}" font-size="12" text-anchor="middle" fill="#1c1b19">${v}</text>`] : []));
    if (v <= margin + height) out.push(`<line x1="${margin}" y1="${v}" x2="${margin + width}" y2="${v}" ${style}/>`, ...(major ? [`<text x="${margin - 6}" y="${v + 4}" font-size="12" text-anchor="end" fill="#1c1b19">${v}</text>`, `<text x="${margin + width + 6}" y="${v + 4}" font-size="12" fill="#1c1b19">${v}</text>`] : []));
  }
  out.push(`<text x="${margin}" y="16" font-size="12" fill="#1c1b19">x →</text>`, `<text x="6" y="${margin + 14}" font-size="12" fill="#1c1b19">y ↓</text>`, "</svg>");
  return out.join("");
}
