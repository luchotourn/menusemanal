import { describe, it, expect, vi } from "vitest";
import {
  parseWeekParam,
  weekParamToDate,
  sanitizeNextPath,
  buildLoginRedirect,
  buildWeekDeepLink,
  buildReviewShareMessage,
  buildWhatsAppShareUrl,
  openShareUi,
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
    expect(parseWeekParam("?week=2026-07-00")).toBeNull();
  });

  it("rejects calendar overflow (days that don't exist in that month)", () => {
    expect(parseWeekParam("?week=2026-02-30")).toBeNull();
    expect(parseWeekParam("?week=2026-04-31")).toBeNull();
    expect(parseWeekParam("?week=2026-02-29")).toBeNull(); // not a leap year
    expect(parseWeekParam("?week=2024-02-29")).toBe("2024-02-29"); // leap year
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

describe("buildLoginRedirect", () => {
  it("encodes the intended destination into ?next=", () => {
    expect(buildLoginRedirect("/app?week=2026-07-06")).toBe(
      "/login?next=%2Fapp%3Fweek%3D2026-07-06"
    );
  });

  it("drops ?next= for the default destination", () => {
    expect(buildLoginRedirect("/app")).toBe("/login");
    expect(buildLoginRedirect("")).toBe("/login");
  });

  it("round-trips through URLSearchParams and sanitizeNextPath (the GuestGuard path)", () => {
    const intended = "/app?week=2026-07-06";
    const redirect = buildLoginRedirect(intended);
    const next = new URLSearchParams(redirect.slice(redirect.indexOf("?"))).get("next");
    expect(sanitizeNextPath(next)).toBe(intended);
  });
});

describe("share message and URLs", () => {
  it("builds the deep link to the week view", () => {
    expect(buildWeekDeepLink("https://menusemanal.app", "2026-07-06")).toBe(
      "https://menusemanal.app/app?week=2026-07-06"
    );
  });

  it("URL-encodes unexpected week values in the deep link", () => {
    expect(buildWeekDeepLink("https://menusemanal.app", "6 - 12 jul")).toBe(
      "https://menusemanal.app/app?week=6%20-%2012%20jul"
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

describe("openShareUi", () => {
  const abortError = () => {
    const error = new Error("user dismissed");
    error.name = "AbortError";
    return error;
  };

  it("prefers the native share sheet and reports success", async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    const openWindow = vi.fn();
    await expect(openShareUi("hola", { nativeShare, openWindow })).resolves.toBe(true);
    expect(nativeShare).toHaveBeenCalledWith({ text: "hola" });
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("treats a user-dismissed sheet (AbortError) as handled, not blocked", async () => {
    const nativeShare = vi.fn().mockRejectedValue(abortError());
    const openWindow = vi.fn();
    await expect(openShareUi("hola", { nativeShare, openWindow })).resolves.toBe(true);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("reports a block when the native sheet fails for other reasons", async () => {
    const nativeShare = vi.fn().mockRejectedValue(new Error("NotAllowedError gesture expired"));
    await expect(openShareUi("hola", { nativeShare, openWindow: vi.fn() })).resolves.toBe(false);
  });

  it("falls back to a wa.me window when there is no native share", async () => {
    const openWindow = vi.fn().mockReturnValue({});
    await expect(openShareUi("hola", { openWindow })).resolves.toBe(true);
    expect(openWindow).toHaveBeenCalledWith("https://wa.me/?text=hola");
  });

  it("reports a block when the popup blocker eats the wa.me window", async () => {
    const openWindow = vi.fn().mockReturnValue(null);
    await expect(openShareUi("hola", { openWindow })).resolves.toBe(false);
  });
});
