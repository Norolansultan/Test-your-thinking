/**
 * A public asset's URL (map tiles, the intro video, the audio) under the build's base path.
 *
 * The study build is served from the site root (Vite's default base "/"), and the asset paths in the
 * scenario bundle are written for it ("/maps/topo/0_0.webp"); for that build this returns the path
 * unchanged. A build for hosting under a sub-path (the web demonstration, `vite build --base ./`)
 * resolves the same path against the page's own address instead, as an absolute URL, so MapLibre,
 * the video element and the audio player all load it from beside the page.
 */
export function assetUrl(path: string): string {
  const base = (import.meta as { readonly env?: { readonly BASE_URL?: string } }).env?.BASE_URL ?? "/";
  if (base === "/" || typeof document === "undefined") return path;
  return new URL(path.replace(/^\/+/, ""), document.baseURI).href;
}
