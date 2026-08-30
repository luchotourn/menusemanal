import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Francis is drawn, not typed: the UI must show the brand mascot image where it
 * talks about him, never the 👨‍🍳 emoji (kept only in plain-text share messages).
 */
const ROOT = path.resolve(__dirname, "../../../..");

describe("FrancisAvatar", () => {
  it("points at PWA icon assets that exist", () => {
    const src = readFileSync(path.join(ROOT, "client/src/components/francis-avatar.tsx"), "utf-8");
    for (const asset of ["/icon-192.png", "/icon-maskable-192.png"]) {
      expect(src).toContain(`"${asset}"`);
      expect(existsSync(path.join(ROOT, "client/public", asset)), asset).toBe(true);
    }
  });

  it("replaces the chef emoji and ChefHat icon in the Francis surfaces", () => {
    for (const file of [
      "client/src/components/generate-week-modal.tsx",
      "client/src/components/week-panel.tsx",
      "client/src/components/commentator/commentator-layout.tsx",
    ]) {
      const src = readFileSync(path.join(ROOT, file), "utf-8");
      expect(src, file).not.toContain("👨‍🍳");
      expect(src, file).not.toContain("ChefHat");
      expect(src, file).toContain("FrancisAvatar");
    }
  });
});
