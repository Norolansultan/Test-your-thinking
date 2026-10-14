import { describe, expect, it } from "vitest";
import { assetUrl } from "../../app/session/asset-url.js";

describe("assetUrl (web demonstration build, `vite build --base ./`)", () => {
  it("leaves the study build's root-relative asset paths unchanged (base \"/\")", () => {
    expect(assetUrl("/maps/topo/0_0.webp")).toBe("/maps/topo/0_0.webp");
    expect(assetUrl("/video/intro.mp4")).toBe("/video/intro.mp4");
    expect(assetUrl("/audio/bgm_tension.mp3")).toBe("/audio/bgm_tension.mp3");
  });
});
