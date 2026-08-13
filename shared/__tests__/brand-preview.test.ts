import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const artifactPath = resolve(import.meta.dirname, "../../preview-identidad-francis.html");
const artifact = readFileSync(artifactPath, "utf8");
const appIcon = readFileSync(
  resolve(import.meta.dirname, "../../attached_assets/brand/francis-app-icon-manual.png"),
);
const avatarIcon = readFileSync(
  resolve(import.meta.dirname, "../../attached_assets/brand/francis-avatar-manual.png"),
);

function embeddedPng(variable: string) {
  const match = artifact.match(
    new RegExp(`--${variable}: url\\(\"data:image/png;base64,([^\"]+)\"\\)`),
  );
  expect(match, `${variable} should contain an embedded PNG`).not.toBeNull();
  return Buffer.from(match![1], "base64");
}

describe("Francis brand preview artifact", () => {
  it("contains the landing and interactive product views", () => {
    expect(artifact).toContain('id="landing-view"');
    expect(artifact).toContain('id="app-view"');
    expect(artifact).toContain('data-screen-panel="semana"');
    expect(artifact).toContain('data-screen-panel="recetario"');
    expect(artifact).toContain('data-screen-panel="detalle"');
    expect(artifact).toContain('data-screen-panel="familia"');
  });

  it("defines the approved brand palette and uses only the manual Francis artwork", () => {
    expect(artifact).toContain("--cobalto: #1f4fa3");
    expect(artifact).toContain("--tomate: #e33a2c");
    expect(artifact).toContain("--maiz: #f7c948");
    expect(artifact).not.toContain('id="francis-character"');
    expect(artifact).not.toContain('href="#francis-character"');
    expect(artifact.match(/class="[^"]*francis-manual-character/g)).toHaveLength(3);
    expect(artifact).toContain("--francis-app-icon: url(\"data:image/png;base64,");
    expect(artifact).toContain("--francis-avatar-icon: url(\"data:image/png;base64,");
    expect(artifact).toContain('<link rel="icon" type="image/png" href="data:image/png;base64,');
    expect(artifact).not.toContain("__FRANCIS_APP_ICON_DATA__");
    expect(artifact).not.toContain("__FRANCIS_AVATAR_DATA__");
    expect(embeddedPng("francis-app-icon")).toEqual(appIcon);
    expect(embeddedPng("francis-avatar-icon")).toEqual(avatarIcon);
  });

  it("keeps the artifact portable and accessible", () => {
    expect(artifact).not.toMatch(/<img\b/i);
    expect(artifact).toContain('aria-label="Vista del artifact"');
    expect(artifact).toContain('aria-live="polite"');
    expect(artifact).toContain("prefers-reduced-motion");
  });
});
