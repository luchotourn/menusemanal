import { describe, it, expect } from "vitest";
import {
  parseWeekParam,
  weekParamToDate,
  sanitizeNextPath,
  buildWeekDeepLink,
  buildReviewShareMessage,
  buildWhatsAppShareUrl,
} from "../review-share";

describe("parseWeekParam", () => {
  it("extracts a valid week date from a search string", () => {
    expect(parseWeekParam("?week=2026-07-06")).toBe("2026-07-06");
    expect(parseWeekParam("?foo=bar&week=2026-07-06")).toBe("2026-07-06");
  });

  it("rejects missing or malformed values", () => {
    expect(parseWeekParam("")).toBeNull();
    expect(parseWeekParam("?week=")).toBeNull();
    expect(parseWeekParam("?week=hoy")).toBeNull();
    expect(parseWeekParam("?week=2026-7-6")).toBeNull();
    expect(parseWeekParam("?week=2026-07-06T00:00")).toBeNull();
  });

  it("rejects impossible months and days", () => {
    expect(parseWeekParam("?week=2026-13-01")).toBeNull();
    expect(parseWeekParam("?week=2026-00-10")).toBeNull();
    expect(parseWeekParam("?week=2026-07-32")).toBeNull();
  });
});

describe("weekParamToDate", () => {
  it("builds a local date (no UTC shift)", () => {
    const date = weekParamToDate("2026-07-06");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(6);
  });
});

describe("sanitizeNextPath", () => {
  it("accepts same-app relative paths", () => {
    expect(sanitizeNextPath("/app?week=2026-07-06")).toBe("/app?week=2026-07-06");
    expect(sanitizeNextPath("/recipes")).toBe("/recipes");
  });

  it("rejects open-redirect attempts", () => {
    expect(sanitizeNextPath("//evil.com/app")).toBeNull();
    expect(sanitizeNextPath("https://evil.com")).toBeNull();
    expect(sanitizeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("rejects empty values", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath("")).toBeNull();
  });
});

describe("share message and URLs", () => {
  it("builds the deep link to the week view", () => {
    expect(buildWeekDeepLink("https://menusemanal.app", "2026-07-06")).toBe(
      "https://menusemanal.app/app?week=2026-07-06"
    );
  });

  it("puts the deep link at the end of the message for link previews", () => {
    const message = buildReviewShareMessage("https://menusemanal.app", "2026-07-06");
    expect(message.endsWith("https://menusemanal.app/app?week=2026-07-06")).toBe(true);
    expect(message).toContain("menú de la semana");
  });

  it("includes the week label when provided", () => {
    const message = buildReviewShareMessage("https://menusemanal.app", "2026-07-06", "6 - 12 jul");
    expect(message).toContain("la semana (6 - 12 jul)");
    expect(message.endsWith("https://menusemanal.app/app?week=2026-07-06")).toBe(true);
  });

  it("URL-encodes the message for wa.me", () => {
    const url = buildWhatsAppShareUrl("hola\n¿qué tal? & chau");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toContain("\n");
    expect(url).not.toContain(" & ");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("hola\n¿qué tal? & chau");
  });
});
