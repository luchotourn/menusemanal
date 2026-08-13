import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../attached_assets/brand/francis-vector");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("Francis vector kit", () => {
  it("provides editable, raster-free vector masters", () => {
    const master = read("francis-master.svg");
    expect(master).toContain('viewBox="0 0 210 224"');
    expect(master).toContain('id="francis-bust"');
    for (const layer of ["shirt", "neckerchief", "head-and-neck", "hair", "face-marks", "moustache", "beret"]) {
      expect(master).toContain(`id="${layer}"`);
    }
    expect(master).not.toMatch(/<image\b|data:image\/(?:png|jpe?g|webp)/i);
  });

  it("keeps identity colors and production variants aligned", () => {
    const tokens = JSON.parse(read("tokens.json"));
    expect(tokens.colors).toEqual({
      blue: "#1F4FA3",
      ink: "#12366C",
      red: "#E33A2C",
      cream: "#F7F0E4",
    });
    expect(read("francis-small.svg")).toContain('viewBox="0 0 64 64"');
    expect(read("francis-one-color.svg")).not.toContain("#e33a2c");
    expect(read("francis-avatar-cream.svg")).not.toContain("__FRANCIS_MASTER_DATA__");
    expect(read("francis-app-icon-cobalt.svg")).not.toContain("__FRANCIS_MASTER_DATA__");
  });

  it("includes the required production PNG sizes", () => {
    for (const size of [1024, 512, 256, 192, 180, 128, 64, 32]) {
      const file = resolve(root, `png/francis-app-icon-cobalt-${size}.png`);
      const bytes = readFileSync(file);
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(statSync(file).size).toBeGreaterThan(500);
    }
  });
});
