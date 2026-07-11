import { describe, it, expect } from "vitest";
import {
  weekProgress,
  creatorActions,
  reviewZone,
  signoffDotColor,
  type PanelReview,
  type PanelSignoff,
} from "../week-panel-utils";

const WEEK = "2026-07-06"; // a Monday

const slot = (fecha: string, tipoComida: string) => ({ fecha, tipoComida });

describe("weekProgress", () => {
  it("reports an empty week as 0 of 14", () => {
    expect(weekProgress(WEEK, [])).toEqual({ planned: 0, total: 14, pct: 0 });
  });

  it("counts a slot once no matter how many meals it holds", () => {
    const plans = [
      slot("2026-07-06", "almuerzo"),
      slot("2026-07-06", "almuerzo"), // second meal, same slot
      slot("2026-07-06", "cena"),
    ];
    expect(weekProgress(WEEK, plans).planned).toBe(2);
  });

  it("reaches 14 of 14 (100%) on a full week", () => {
    const plans = [];
    for (let day = 6; day <= 12; day++) {
      const fecha = `2026-07-${String(day).padStart(2, "0")}`;
      plans.push(slot(fecha, "almuerzo"), slot(fecha, "cena"));
    }
    expect(weekProgress(WEEK, plans)).toEqual({ planned: 14, total: 14, pct: 100 });
  });

  it("ignores meals outside the visible week", () => {
    expect(weekProgress(WEEK, [slot("2026-07-13", "almuerzo")]).planned).toBe(0);
  });
});

describe("creatorActions (hierarchy flip)", () => {
  const partial = { planned: 10, total: 14, pct: 71 };
  const full = { planned: 14, total: 14, pct: 100 };

  it("leads with Francis while the week has holes", () => {
    expect(creatorActions(partial, null)).toEqual({
      plan: "primary",
      planLabel: "Planear con Francis",
      send: "ghost",
      sendLabel: "Revisión",
    });
  });

  it("flips to Enviar once the week is full", () => {
    expect(creatorActions(full, null)).toEqual({
      plan: "ghost",
      planLabel: "Regenerar…",
      send: "primary",
      sendLabel: "Enviar",
    });
  });

  it("keeps both actions quiet while the family reviews", () => {
    expect(creatorActions(full, "submitted")).toEqual({
      plan: "ghost",
      planLabel: "Regenerar…",
      send: "ghost",
      sendLabel: "Reenviar",
    });
  });

  it("makes Reenviar primary only when changes were requested", () => {
    expect(creatorActions(full, "changes_requested")).toEqual({
      plan: "ghost",
      planLabel: "Regenerar…",
      send: "primary",
      sendLabel: "Reenviar semana",
    });
  });

  it("hides the send action after approval", () => {
    expect(creatorActions(full, "approved")).toEqual({
      plan: "ghost",
      planLabel: "Regenerar…",
      send: "hidden",
      sendLabel: "",
    });
  });
});

describe("reviewZone", () => {
  const signoff = (overrides: Partial<PanelSignoff>): PanelSignoff => ({
    id: 1,
    userId: 1,
    userName: "Sofi",
    verdict: "approved",
    note: null,
    ...overrides,
  });

  const review = (
    status: PanelReview["status"],
    signoffs: PanelSignoff[] = [],
  ): PanelReview => ({ status, submittedAt: "2026-07-11T12:00:00Z", signoffs });

  it("is empty without a review", () => {
    expect(reviewZone(null)).toEqual({ kind: "none" });
  });

  it("waits after submitting", () => {
    expect(reviewZone(review("submitted"))).toEqual({
      kind: "waiting",
      submittedAt: "2026-07-11T12:00:00Z",
    });
  });

  it("surfaces change-request notes first", () => {
    const zone = reviewZone(
      review("changes_requested", [
        signoff({ id: 1, userName: "Sofi", verdict: "approved", note: "¡rico!" }),
        signoff({ id: 2, userName: "Mati", verdict: "changes_requested", note: "más pastas" }),
      ]),
    );
    expect(zone.kind).toBe("changes");
    if (zone.kind === "changes") {
      expect(zone.notes.map((n) => n.note)).toEqual(["más pastas", "¡rico!"]);
    }
  });

  it("lists who approved, keeping their notes", () => {
    const zone = reviewZone(
      review("approved", [
        signoff({ id: 1, userId: 1, userName: "Sofi", note: "¡la pizza! 🙌" }),
        signoff({ id: 2, userId: 2, userName: "Mati", note: null }),
      ]),
    );
    expect(zone).toEqual({
      kind: "approved",
      approvedBy: ["Sofi", "Mati"],
      notes: [expect.objectContaining({ userName: "Sofi", note: "¡la pizza! 🙌" })],
    });
  });
});

describe("signoffDotColor", () => {
  it("is deterministic per name", () => {
    expect(signoffDotColor("Sofi")).toBe(signoffDotColor("Sofi"));
  });

  it("returns a hex color", () => {
    expect(signoffDotColor("Mati")).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
