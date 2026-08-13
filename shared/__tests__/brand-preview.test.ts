import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const artifactPath = resolve(import.meta.dirname, "../../preview-identidad-francis.html");
const artifact = readFileSync(artifactPath, "utf8");

describe("Francis brand preview artifact", () => {
  it("contains the landing and interactive product views", () => {
    expect(artifact).toContain('id="landing-view"');
    expect(artifact).toContain('id="app-view"');
    expect(artifact).toContain('data-screen-panel="semana"');
    expect(artifact).toContain('data-screen-panel="recetario"');
    expect(artifact).toContain('data-screen-panel="detalle"');
    expect(artifact).toContain('data-screen-panel="familia"');
  });

  it("defines the approved brand palette and Francis illustration", () => {
    expect(artifact).toContain("--cobalto: #1f4fa3");
    expect(artifact).toContain("--tomate: #e33a2c");
    expect(artifact).toContain("--maiz: #f7c948");
    expect(artifact).toContain('id="francis-character"');
  });

  it("keeps the artifact portable and accessible", () => {
    expect(artifact).not.toMatch(/<img\b/i);
    expect(artifact).toContain('aria-label="Vista del artifact"');
    expect(artifact).toContain('aria-live="polite"');
    expect(artifact).toContain("prefers-reduced-motion");
  });
});
