import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { formatEnhancedWeekRange } from "@/lib/utils";
import {
  weekProgress,
  creatorActions,
  reviewZone,
  signoffDotColor,
  type ActionEmphasis,
  type PanelReview,
} from "@/components/week-panel-utils";

interface WeekPanelProps {
  weekStart: Date;
  weekStartStr: string;
  isCurrentWeek: boolean;
  isTransitioning: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onGoToCurrentWeek: () => void;
  mealPlans: { fecha: string; tipoComida: string }[];
  review: PanelReview | null;
  currentUserId?: number;
  isCreator: boolean;
  isSubmitting: boolean;
  isSigningOff: boolean;
  /** Opens the Francis weekly-plan sheet for the visible week. */
  onOpenPlanner?: () => void;
  /** Opens the submit-for-review confirmation (one-tap submit + share). */
  onSubmit: () => void;
  /** Opens the commentator sign-off dialog with the given verdict. */
  onSignoff: (verdict: "approved" | "changes_requested") => void;
}

const ACTION_STYLES: Record<Exclude<ActionEmphasis, "hidden">, string> = {
  primary:
    "bg-brasa hover:bg-brasa/90 active:scale-[0.99] text-white font-bold shadow-md shadow-brasa/30",
  ghost:
    "bg-papel hover:bg-crema border border-tinta/15 text-tinta/75 font-semibold",
};

function ActionButton({
  emphasis,
  disabled,
  onClick,
  children,
  grow = 1,
}: {
  emphasis: ActionEmphasis;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  grow?: number;
}) {
  if (emphasis === "hidden") return null;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{ flexGrow: grow }}
      className={`flex basis-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2.5 text-xs transition-all disabled:opacity-50 disabled:pointer-events-none ${ACTION_STYLES[emphasis]}`}
    >
      {children}
    </button>
  );
}

/**
 * The week's command center (option 3 of the semana-topbar exploration): one
 * card holding week navigation, the planning progress bar, the review
 * lifecycle callout and the two creator actions with a hierarchy that flips
 * as the week fills. Commentators get the same card minus planning — their
 * panel is for opining, not planning.
 */
export function WeekPanel({
  weekStart,
  weekStartStr,
  isCurrentWeek,
  isTransitioning,
  onPreviousWeek,
  onNextWeek,
  onGoToCurrentWeek,
  mealPlans,
  review,
  currentUserId,
  isCreator,
  isSubmitting,
  isSigningOff,
  onOpenPlanner,
  onSubmit,
  onSignoff,
}: WeekPanelProps) {
  const weekInfo = formatEnhancedWeekRange(weekStart);
  const progress = weekProgress(weekStartStr, mealPlans);
  const zone = reviewZone(review);
  const actions = creatorActions(progress, review?.status ?? null);
  const approved = zone.kind === "approved";

  const mySignoff =
    currentUserId != null && review
      ? review.signoffs.find((s) => s.userId === currentUserId)
      : undefined;

  const navButton =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-tinta/10 bg-papel text-tinta/60 hover:bg-crema transition-colors disabled:opacity-40";

  return (
    <div className="rounded-2xl border border-tinta/10 bg-papel p-3.5 shadow-sm">
      {/* Week navigation */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onPreviousWeek}
          disabled={isTransitioning}
          aria-label="Semana anterior"
          className={navButton}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          className={`min-w-0 flex-1 transition-opacity duration-200 ${isTransitioning ? "opacity-50" : "opacity-100"}`}
        >
          <p className="truncate text-[15px] font-extrabold leading-tight text-tinta">
            {isCurrentWeek ? "Esta semana" : weekInfo.range}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-tinta/45">
            {isCurrentWeek ? weekInfo.range : weekInfo.monthContext}
          </p>
        </div>
        {!isCurrentWeek && (
          <button
            type="button"
            onClick={onGoToCurrentWeek}
            className="shrink-0 whitespace-nowrap rounded-full border border-tinta/15 bg-papel px-3 py-1.5 text-[11px] font-bold text-tinta/70 hover:bg-crema transition-colors"
          >
            Hoy
          </button>
        )}
        <button
          type="button"
          onClick={onNextWeek}
          disabled={isTransitioning}
          aria-label="Semana siguiente"
          className={navButton}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Planning progress — creators plan, so only they get the meter */}
      {isCreator && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-tinta/10">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                approved ? "bg-menta" : "bg-gradient-to-r from-durazno to-brasa"
              }`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-tinta/50">
            {progress.planned} de {progress.total} comidas planeadas
          </p>
        </>
      )}

      {/* Review lifecycle — one slot, the callout changes with the state.
          A commentator who hasn't opined yet sees the invite instead. */}
      {zone.kind === "waiting" && (isCreator || mySignoff) && (
        <div className="mt-2.5 rounded-xl border border-durazno bg-durazno-suave px-3 py-2">
          <p className="text-xs font-extrabold text-tinta/80">⏳ En revisión</p>
          <p className="mt-0.5 text-[11px] leading-snug text-tinta/60">
            Esperando a la familia · enviada{" "}
            {formatDistanceToNow(new Date(zone.submittedAt), { addSuffix: true, locale: es })}
          </p>
        </div>
      )}

      {zone.kind === "changes" && (
        <div className="mt-2.5 rounded-xl border border-rojo/30 bg-rojo-suave px-3 py-2">
          <p className="text-xs font-extrabold text-tinta/80">✏️ Pidieron cambios</p>
          <ul className="mt-1 space-y-1">
            {zone.notes.map((note) => (
              <li key={note.id} className="flex items-start gap-1.5 text-[11px] leading-snug text-tinta/70">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                  style={{ backgroundColor: signoffDotColor(note.userName) }}
                >
                  {note.userName.charAt(0).toUpperCase()}
                </span>
                <span>
                  <span className="font-bold">{note.userName}:</span>{" "}
                  <span className="italic">«{note.note}»</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {zone.kind === "approved" && (
        <div className="mt-2.5 rounded-xl border border-menta/60 bg-menta-suave px-3 py-2">
          <p className="text-xs font-extrabold text-tinta/80">🎉 Semana aprobada</p>
          <ul className="mt-1 space-y-1">
            {zone.approvedBy.map((name) => {
              const note = zone.notes.find((n) => n.userName === name);
              return (
                <li key={name} className="flex items-start gap-1.5 text-[11px] leading-snug text-tinta/70">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                    style={{ backgroundColor: signoffDotColor(name) }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <span>
                    {name} aprobó
                    {note ? <span className="italic"> · «{note.note}»</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Creator actions — Francis plans, Enviar shares, hierarchy flips */}
      {isCreator && (
        <div className="mt-3 flex items-stretch gap-2">
          {onOpenPlanner && (
            <ActionButton emphasis={actions.plan} onClick={onOpenPlanner} grow={actions.plan === "primary" ? 1.4 : 1}>
              <span aria-hidden="true" className="text-sm leading-none">👨‍🍳</span>
              {actions.planLabel}
            </ActionButton>
          )}
          <ActionButton
            emphasis={actions.send}
            onClick={onSubmit}
            disabled={isSubmitting || mealPlans.length === 0}
            grow={actions.send === "primary" ? 1.4 : 1}
          >
            <Send className="h-3.5 w-3.5" />
            {actions.sendLabel}
          </ActionButton>
        </div>
      )}

      {/* Commentator zone: the invite to opine, or their own verdict */}
      {!isCreator && review && (
        <>
          {mySignoff ? (
            <p className="mt-2.5 text-[11px] leading-snug text-tinta/60">
              {mySignoff.verdict === "approved"
                ? "Aprobaste esta semana"
                : "Pediste cambios en esta semana"}
              {mySignoff.note ? <span className="italic"> · «{mySignoff.note}»</span> : null}
            </p>
          ) : (
            <div className="mt-2.5 rounded-xl border border-uva/40 bg-uva-suave px-3 py-2">
              <p className="text-xs font-extrabold text-tinta/80">
                👀 Llegó el menú de la semana
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-tinta/60">
                Mirá los platos y contanos qué te parece
              </p>
              <div className="mt-2 flex items-stretch gap-2">
                <button
                  type="button"
                  disabled={isSigningOff}
                  onClick={() => onSignoff("approved")}
                  className="flex grow-[1.15] basis-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-extrabold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                >
                  👍 Aprobar semana
                </button>
                <button
                  type="button"
                  disabled={isSigningOff}
                  onClick={() => onSignoff("changes_requested")}
                  className="flex grow basis-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-tinta/15 bg-papel px-3 py-2 text-[11px] font-bold text-tinta/75 transition-colors hover:bg-crema disabled:opacity-50"
                >
                  💬 Pedir cambios
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
