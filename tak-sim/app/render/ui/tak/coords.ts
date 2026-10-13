/**
 * MGRS for the TAK shell's coordinate readout, Range & Bearing and video captions (SPEC/28 §5), with the `mgrs` package
 * (proj4js, MIT). Pure: a point gives the same string every time.
 *
 * The package ships an ES build (named exports, what Vite bundles) and a UMD build (a default export, what Node loads in
 * the tests); both are read here.
 */

import * as mgrsModule from "mgrs";
import type { LatLon } from "../../../engine/primitives.js";
import { spaceMgrs } from "./shell.js";

type Forward = (ll: [number, number], accuracy?: number) => string;
const mod = mgrsModule as unknown as { readonly forward?: Forward; readonly default?: { readonly forward?: Forward } };
const forward: Forward | undefined = mod.forward ?? mod.default?.forward;

/** A point in MGRS, spaced as ATAK shows it ("35V NH 19019 46130"); `accuracy` digits per axis (5 = 1 m). "—" if it cannot be converted. */
export function toMgrs(p: LatLon, accuracy = 5): string {
  if (!forward) return "—";
  try {
    return spaceMgrs(forward([p.lon, p.lat], accuracy));
  } catch {
    return "—";
  }
}
