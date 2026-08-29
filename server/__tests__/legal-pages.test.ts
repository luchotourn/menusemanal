import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Legal pages (/privacidad, /terminos) are static HTML served next to the
 * landing. This guards that both exist, are wired in routes.ts, get copied by
 * the build and cover the sections a LATAM consumer app is expected to state.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf-8");

const pages = {
  privacidad: read("server/legal/privacidad.html"),
  terminos: read("server/legal/terminos.html"),
};

describe("legal pages", () => {
  it("are served by routes.ts and copied by the build", () => {
    const routes = read("server/routes.ts");
    expect(routes).toContain('["privacidad", "terminos"]');
    expect(routes).toContain('path.resolve(import.meta.dirname, "legal", `${page}.html`)');
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.build).toContain("cp server/legal/*.html dist/legal/");
  });

  it("share the brand chrome and link to each other and to the landing", () => {
    for (const [name, html] of Object.entries(pages)) {
      expect(html, name).toContain('<html lang="es">');
      expect(html, name).toContain('name="theme-color" content="#1F4FA3"');
      expect(html, name).toContain('href="/"');
      expect(html, name).toContain("family=Jost");
      expect(html, name).toContain("hola@menusemanal.app");
      expect((html.match(/<h1[\s>]/g) ?? []).length, name).toBe(1);
    }
    expect(pages.privacidad).toContain('href="/terminos"');
    expect(pages.terminos).toContain('href="/privacidad"');
  });

  it("privacy policy covers the standard sections", () => {
    for (const heading of [
      "Qué datos recopilamos",
      "Menores de edad",
      "Para qué usamos los datos",
      "Inteligencia artificial",
      "Con quién compartimos datos",
      "Cookies y almacenamiento local",
      "Cuánto tiempo conservamos los datos",
      "Seguridad",
      "Tus derechos",
      "Contacto",
    ]) {
      expect(pages.privacidad).toContain(heading);
    }
    expect(pages.privacidad).toContain("Ley 25.326");
    expect(pages.privacidad).toContain("No vendemos tus datos");
  });

  it("terms cover the standard sections", () => {
    for (const heading of [
      "Aceptación",
      "Acceso anticipado y gratuidad",
      "Tu cuenta y tu familia",
      "Tu contenido",
      "Francis y la inteligencia artificial",
      "Uso aceptable",
      "Propiedad intelectual",
      "Limitación de responsabilidad",
      "Terminación",
      "Ley aplicable y jurisdicción",
      "Contacto",
    ]) {
      expect(pages.terminos).toContain(heading);
    }
    expect(pages.terminos).toContain("no asesoramiento nutricional");
    expect(pages.terminos).toContain("defensa del consumidor");
  });
});
