import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Positano brand tokens — guards the approved palette (paleta B "Tricolor + tinta")
 * and the WCAG contrast pairs the redesign relies on. If someone tweaks a hex in
 * index.css, this test tells them which pairing they just broke.
 */

const ROOT = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(ROOT, "client/src/index.css"), "utf-8");

function rootBlock(): string {
  const start = css.indexOf(":root {");
  const end = css.indexOf("\n}\n", start);
  return css.slice(start, end);
}

function token(name: string, block = rootBlock()): string {
  const m = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1].trim();
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("Positano palette tokens", () => {
  it("defines the approved core colors", () => {
    expect(token("crema")).toBe("#F7F2EC");
    expect(token("papel")).toBe("#FFFDF9");
    expect(token("tinta")).toBe("#12366C");
    expect(token("cobalto")).toBe("#1F4FA3");
    expect(token("tomate")).toBe("#E33A2C");
    expect(token("tomate-texto")).toBe("#C93122");
    expect(token("maiz")).toBe("#F7C948");
    expect(token("cielo")).toBe("#E4ECF9");
    expect(token("maiz-suave")).toBe("#FDF3D0");
    expect(token("tomate-suave")).toBe("#FBE7E4");
  });

  it("routes the legacy semantic aliases into the new palette", () => {
    expect(token("brasa")).toBe("var(--tomate)");
    expect(token("durazno")).toBe("var(--maiz)");
    expect(token("durazno-suave")).toBe("var(--maiz-suave)");
    expect(token("uva")).toBe("var(--cobalto)");
    expect(token("uva-suave")).toBe("var(--cielo)");
    expect(token("menta")).toBe("var(--cobalto)");
    expect(token("rojo")).toBe("var(--tomate-texto)");
  });

  it("retires the old orange brand everywhere the manifest/shell used it", () => {
    for (const file of [
      "client/src/index.css",
      "client/index.html",
      "client/public/manifest.json",
      "client/src/pages/login.tsx",
      "client/src/pages/register.tsx",
      "client/src/components/header.tsx",
    ]) {
      const content = readFileSync(path.join(ROOT, file), "utf-8").toLowerCase();
      expect(content, file).not.toContain("#d4825a");
      expect(content, file).not.toContain("#ff6b35");
      expect(content, file).not.toContain("#e8a882");
    }
  });
});

describe("Positano contrast contract (WCAG 2.1)", () => {
  const crema = "#F7F2EC";
  const tinta = "#12366C";
  const cobalto = "#1F4FA3";
  const tomate = "#E33A2C";
  const tomateTexto = "#C93122";
  const maiz = "#F7C948";
  const maizSuave = "#FDF3D0";
  const cielo = "#E4ECF9";

  it("body text passes AAA and headings/links pass AA on cream", () => {
    expect(contrast(tinta, crema)).toBeGreaterThanOrEqual(7);
    expect(contrast(cobalto, crema)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tinta, "#FFFDF9")).toBeGreaterThanOrEqual(7);
  });

  it("primary buttons keep white text legible", () => {
    // Tomate is a fill color: button labels are bold ≥15px, so the WCAG large-text
    // threshold (3:1) applies. Measured 4.28:1 — never use tomate behind body text.
    expect(contrast("#FFFFFF", tomate)).toBeGreaterThanOrEqual(3);
    expect(contrast("#FFFFFF", tomate)).toBeLessThan(4.5);
    expect(contrast("#FFFFFF", cobalto)).toBeGreaterThanOrEqual(4.5);
  });

  it("small red text uses tomate-texto, never tomate", () => {
    expect(contrast(tomateTexto, crema)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tomate, crema)).toBeLessThan(4.5); // documents why the variant exists
  });

  it("soft surfaces stay readable with tinta on top", () => {
    expect(contrast(tinta, maizSuave)).toBeGreaterThanOrEqual(7);
    expect(contrast(tinta, cielo)).toBeGreaterThanOrEqual(7);
    expect(contrast(tinta, maiz)).toBeGreaterThanOrEqual(4.5);
  });

  it("maíz is never a text color on cream", () => {
    expect(contrast(maiz, crema)).toBeLessThan(3);
  });
});

describe("PWA manifest + icons", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "client/public/manifest.json"), "utf-8"));

  it("uses the brand colors and Spanish name", () => {
    expect(manifest.name).toBe("Menú Semanal");
    expect(manifest.theme_color).toBe("#1F4FA3");
    expect(manifest.background_color).toBe("#F7F2EC");
  });

  it("declares any + maskable icons and every file exists with the declared size", () => {
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const file = path.join(ROOT, "client/public", icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const buf = readFileSync(file);
      // PNG IHDR: width at bytes 16-19, height at 20-23
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      expect(`${width}x${height}`).toBe(icon.sizes);
    }
  });

  it("ships the favicon set referenced by index.html", () => {
    const html = readFileSync(path.join(ROOT, "client/index.html"), "utf-8");
    for (const f of ["/favicon.ico", "/favicon-32.png", "/favicon-16.png", "/apple-touch-icon.png"]) {
      expect(html).toContain(`href="${f}"`);
      expect(existsSync(path.join(ROOT, "client/public", f)), f).toBe(true);
    }
    expect(html).toContain('name="theme-color" content="#1F4FA3"');
    expect(html).toContain("family=Jost");
  });
});

describe("PR review fixes", () => {
  it("dark theme redefines every brand token the light theme has, including maíz", () => {
    const start = css.indexOf(".dark {");
    const dark = css.slice(start, css.indexOf("\n}\n", start));
    for (const name of ["crema", "papel", "tinta", "cobalto", "tomate", "tomate-texto", "maiz", "cielo", "maiz-suave", "tomate-suave"]) {
      expect(dark, `--${name} in .dark`).toMatch(new RegExp(`--${name}:`));
    }
  });

  it("sticky search surfaces use the papel token instead of hardcoded white", () => {
    expect(css).not.toContain("rgba(255, 255, 255, 0.98)");
    expect(css).toContain("color-mix(in srgb, var(--papel) 96%, transparent)");
  });

  it("register never logs user data and the auth fine print links to the legal pages", () => {
    const register = readFileSync(path.join(ROOT, "client/src/pages/register.tsx"), "utf-8");
    const login = readFileSync(path.join(ROOT, "client/src/pages/login.tsx"), "utf-8");
    const layout = readFileSync(path.join(ROOT, "client/src/components/auth-layout.tsx"), "utf-8");
    expect(register).not.toContain("console.log");
    expect(register).not.toContain('href="#"');
    expect(layout).toContain('href="/terminos"');
    expect(layout).toContain('href="/privacidad"');
    expect(register).toContain("LegalNotice");
    expect(login).toContain("LegalNotice");
  });
});
