// Pure helpers for the WeekPanel — kept free of JSX/React so they can be unit
// tested in the node environment, following the meal-card-utils precedent.

import { allWeekSlots, computeEmptySlots } from "@shared/weekly-plan";
import { selectReviewNotes } from "@shared/utils";

export type PanelReviewStatus = "submitted" | "approved" | "changes_requested";

export type PanelSignoff = {
  id: number;
  userId: number;
  userName: string;
  verdict: "approved" | "changes_requested";
  note: string | null;
};

export type PanelReview = {
  status: PanelReviewStatus;
  submittedAt: string;
  signoffs: PanelSignoff[];
};

export interface WeekProgress {
  planned: number;
  total: number;
  /** 0–100, rounded. */
  pct: number;
}

/**
 * Slot-based progress: a slot (day × almuerzo/cena) counts once no matter how
 * many meals it holds, so 14/14 really means "every slot has something".
 */
export function weekProgress(
  weekStartDate: string,
  mealPlans: { fecha: string; tipoComida: string }[],
): WeekProgress {
  const total = allWeekSlots(weekStartDate).length;
  const planned = total - computeEmptySlots(weekStartDate, mealPlans).length;
  return { planned, total, pct: Math.round((planned / total) * 100) };
}

export type ActionEmphasis = "primary" | "ghost" | "hidden";

export interface CreatorActions {
  plan: ActionEmphasis;
  planLabel: string;
  send: ActionEmphasis;
  sendLabel: string;
}

/**
 * The hierarchy flip: Francis leads while the week has holes, Enviar leads
 * once it's full, and Reenviar only becomes primary when changes were asked.
 */
export function creatorActions(
  progress: WeekProgress,
  reviewStatus: PanelReviewStatus | null,
): CreatorActions {
  if (reviewStatus === "approved") {
    return { plan: "ghost", planLabel: "Regenerar…", send: "hidden", sendLabel: "" };
  }
  if (reviewStatus === "changes_requested") {
    return { plan: "ghost", planLabel: "Regenerar…", send: "primary", sendLabel: "Reenviar semana" };
  }
  if (reviewStatus === "submitted") {
    return { plan: "ghost", planLabel: "Regenerar…", send: "ghost", sendLabel: "Reenviar" };
  }
  if (progress.planned >= progress.total) {
    return { plan: "ghost", planLabel: "Regenerar…", send: "primary", sendLabel: "Enviar" };
  }
  return { plan: "primary", planLabel: "Planear con Francis", send: "ghost", sendLabel: "Revisión" };
}

export type ReviewZone =
  | { kind: "none" }
  | { kind: "waiting"; submittedAt: string }
  | { kind: "changes"; notes: Array<PanelSignoff & { note: string }> }
  | {
      kind: "approved";
      approvedBy: string[];
      notes: Array<PanelSignoff & { note: string }>;
    };

/** One slot below the progress bar; which callout fills it depends on state. */
export function reviewZone(review: PanelReview | null): ReviewZone {
  if (!review) return { kind: "none" };
  if (review.status === "submitted") {
    return { kind: "waiting", submittedAt: review.submittedAt };
  }
  const notes = selectReviewNotes(review.signoffs);
  if (review.status === "changes_requested") {
    return { kind: "changes", notes };
  }
  return {
    kind: "approved",
    approvedBy: review.signoffs
      .filter((s) => s.verdict === "approved")
      .map((s) => s.userName),
    notes,
  };
}

// Saturated in both themes; order matters only for variety, the hash picks.
const DOT_COLORS = ["#9C6ADE", "#E85D75", "#17877D", "#FF6B35", "#2E86AB"];

/** Deterministic author dot color — same name, same color, everywhere. */
export function signoffDotColor(userName: string): string {
  let hash = 0;
  for (const char of userName) hash = (hash + char.codePointAt(0)!) % 997;
  return DOT_COLORS[hash % DOT_COLORS.length];
}
