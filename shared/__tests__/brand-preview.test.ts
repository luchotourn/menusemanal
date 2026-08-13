import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const artifactPath = resolve(import.meta.dirname, "../../preview-identidad-francis.html");
const artifact = readFileSync(artifactPath, "utf8");
const vectorRoot = resolve(import.meta.dirname, "../../attached_assets/brand/francis-vector");
const appIcon = readFileSync(resolve(vectorRoot, "francis-app-icon-cobalt.svg"));
const master = readFileSync(resolve(vectorRoot, "francis-master.svg"));

function embeddedSvg(variable: string) {
  const match = artifact.match(
    new RegExp(`--${variable}: url\\(\"data:image/svg\\+xml;base64,([^\"]+)\"\\)`),
  );
  expect(match, `${variable} should contain an embedded SVG`).not.toBeNull();
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
    expect(artifact).toContain('href="/francis-vector/francis-vector-kit.zip"');
  });

  it("defines the approved palette and embeds the scalable Francis masters", () => {
    expect(artifact).toContain("--cobalto: #1f4fa3");
    expect(artifact).toContain("--tomate: #e33a2c");
    expect(artifact).toContain("--maiz: #f7c948");
    expect(artifact).not.toContain('id="francis-character"');
    expect(artifact).not.toContain('href="#francis-character"');
    expect(artifact.match(/class="[^"]*francis-vector-character/g)).toHaveLength(3);
    expect(artifact).toContain("--francis-app-icon: url(\"data:image/svg+xml;base64,");
    expect(artifact).toContain("--francis-avatar-icon: url(\"data:image/svg+xml;base64,");
    expect(artifact).toContain('<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,');
    expect(embeddedSvg("francis-app-icon")).toEqual(appIcon);
    expect(embeddedSvg("francis-avatar-icon")).toEqual(master);
  });

  it("keeps the artifact portable and accessible", () => {
    expect(artifact).not.toMatch(/<img\b/i);
    expect(artifact).toContain('aria-label="Vista del artifact"');
    expect(artifact).toContain('aria-live="polite"');
    expect(artifact).toContain("prefers-reduced-motion");
  });
});
