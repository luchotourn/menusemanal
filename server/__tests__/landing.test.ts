import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// The landing page is served verbatim by routes.ts for guests and copied to
// dist by the build script, so we assert on the raw HTML file itself.
const html = fs.readFileSync(
  path.resolve(__dirname, "..", "landing.html"),
  "utf-8",
);

describe("landing.html (rediseño Positano / Toldo)", () => {
  it("has exactly one <h1> with the approved headline", () => {
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    expect(h1s).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Chau al «¿qué comemos hoy\?»<\/h1>/);
  });

  it("uses the approved hero paragraph and drops the old tagline", () => {
    expect(html).toContain(
      "Organizá las comidas de la semana con Francis, la IA de las familias modernas.",
    );
    expect(html).not.toContain("Menú familiar, hecho con amor");
    expect(html).not.toContain("Menu familiar, hecho con amor");
  });

  it("keeps both waitlist forms with their analytics sources", () => {
    const forms = html.match(/<form[^>]*class="waitlist-form"[^>]*>/g) ?? [];
    expect(forms).toHaveLength(2);
    expect(forms.some((f) => f.includes('data-source="hero"'))).toBe(true);
    expect(forms.some((f) => f.includes('data-source="footer"'))).toBe(true);
  });

  it("keeps the waitlist submission contract (CSRF header + endpoint)", () => {
    expect(html).toContain("X-CSRF-Token");
    expect(html).toContain("/api/waitlist");
    expect(html).toContain("csrf_token");
  });

  it("keeps real anchors to /login and /register", () => {
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
  });

  it("lists the six FAQ questions", () => {
    const questions = [
      "¿Es gratis?",
      "¿Funciona como app en el celular?",
      "¿Qué rol pueden tener los chicos?",
      "¿Cómo funciona la inteligencia artificial?",
      "¿En qué países está disponible?",
      "¿Puedo invitar a mi familia?",
    ];
    for (const q of questions) {
      expect(html).toContain(q);
    }
    const triggers = html.match(/class="qt"/g) ?? [];
    expect(triggers).toHaveLength(6);
  });

  it("uses the Positano brand metadata and assets", () => {
    expect(html).toMatch(/<meta name="theme-color" content="#1F4FA3"/);
    expect(html).toContain("/brand/francis.webp");
    expect(html).toContain("/brand/francis.png");
    expect(html).toContain('property="og:image" content="/brand/og.png"');
    expect(html).toContain("<title>Menú Semanal — Chau al «¿qué comemos hoy?»</title>");
  });

  it("contains no legacy orange palette values", () => {
    expect(html).not.toMatch(/#FF6B35/i);
    expect(html).not.toMatch(/#d4825a/i);
  });
});
