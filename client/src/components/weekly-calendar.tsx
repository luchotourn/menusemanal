import { useState, useEffect } from "react";
import { Share2 } from "lucide-react";
import { AddMealButton } from "@/components/add-meal-button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery } from "@tanstack/react-query";
import { formatWeekRange, formatEnhancedWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import { parseWeekParam, weekParamToDate, buildReviewShareMessage, openShareUi } from "@/lib/review-share";
import type { MealCommentInline, MealPlan, Recipe } from "@shared/schema";
import { MealCard } from "@/components/meal-card";
import type { PendingProposalSummary } from "@/components/meal-card-utils";
import { MealCommentSheet } from "@/components/meal-comment-sheet";
import { useUserRole } from "@/components/role-based-wrapper";
import { WeekPanel } from "@/components/week-panel";
import { useWeeklyReview } from "@/hooks/use-weekly-review";
import { useProfile } from "@/hooks/useAuth";

type MealPlanWithCommentsAndRecipe = MealPlan & {
  recipe: Recipe | null;
  comments: MealCommentInline[];
  pendingProposalCount: number;
  latestPendingProposal: PendingProposalSummary | null;
};

interface WeeklyCalendarProps {
  onAddMeal: (date: string, mealType: string) => void;
  onViewMealPlan: (mealPlan: MealPlan & { recipe?: Recipe; comments?: MealCommentInline[] }) => void;
  /** Keeps the parent in sync with the visible week (the Francis planner targets it). */
  onWeekChange?: (weekStart: Date) => void;
  /** Opens the Francis weekly-plan sheet (owned by the parent page). */
  onOpenPlanner?: () => void;
}

export function WeeklyCalendar({ onAddMeal, onViewMealPlan, onWeekChange, onOpenPlanner }: WeeklyCalendarProps) {
  const { isCreator } = useUserRole();
  // Deep links (?week=YYYY-MM-DD, e.g. from a shared WhatsApp review message)
  // open the calendar on that week; otherwise the current one.
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const weekParam = parseWeekParam(window.location.search);
    return getMonday(weekParam ? weekParamToDate(weekParam) : new Date());
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [commentSheetMeal, setCommentSheetMeal] = useState<{
    mealPlanId: number;
    recipeId: number;
    recipeName: string;
    fecha: string;
  } | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [pendingSignoffVerdict, setPendingSignoffVerdict] = useState<"approved" | "changes_requested" | null>(null);
  const [signoffNote, setSignoffNote] = useState("");

  const weekStartStr = formatDate(currentWeekStart);

  // Report the visible week upward whenever it changes (and once on mount).
  useEffect(() => {
    onWeekChange?.(currentWeekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartStr]);
  const {
    review,
    submit: submitReview,
    isSubmitting,
    signoff: submitSignoff,
    isSigningOff,
  } = useWeeklyReview(weekStartStr);
  const { profile } = useProfile();
  const currentUserId = profile?.id;

  const { data: mealPlans, isLoading } = useQuery({
    queryKey: ["/api/meal-plans", { startDate: formatDate(currentWeekStart) }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: formatDate(currentWeekStart) });
      const response = await fetch(`/api/meal-plans?${params}`);
      if (!response.ok) throw new Error("Error al cargar el plan de comidas");
      return response.json() as Promise<MealPlanWithCommentsAndRecipe[]>;
    },
  });

  const weekDates = getWeekDates(currentWeekStart);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys when no input/textarea is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'BUTTON') {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousWeek();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextWeek();
      } else if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        goToCurrentWeek();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWeekStart]);

  const previousWeek = () => {
    setIsTransitioning(true);
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
    setTimeout(() => setIsTransitioning(false), 200);
  };

  const nextWeek = () => {
    setIsTransitioning(true);
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
    setTimeout(() => setIsTransitioning(false), 200);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const currentWeek = getMonday(today);
    setCurrentWeekStart(currentWeek);
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const todayMonday = getMonday(today);
    return formatDate(todayMonday) === formatDate(currentWeekStart);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDate(date) === formatDate(today);
  };

  // Share the review deep link — semantics (native sheet vs wa.me, blocked vs
  // dismissed) live in openShareUi, which is unit tested with injected ports.
  const shareReviewNow = (): Promise<boolean> =>
    openShareUi(
      buildReviewShareMessage(
        window.location.origin,
        weekStartStr,
        formatWeekRange(currentWeekStart),
      ),
      {
        nativeShare: navigator.share?.bind(navigator),
        openWindow: (url) => window.open(url, "_blank", "noopener"),
      },
    );

  // One button, one flow: confirming "Enviar para revisión" submits and then
  // opens the share sheet right away. The dialog closes only on success — on
  // failure it stays open (the hook already toasts the error) so the user can
  // retry or cancel.
  const handleSubmitAndShare = () => {
    submitReview(undefined, {
      onSuccess: () => {
        setShowSubmitConfirm(false);
        void shareReviewNow().then((shared) => {
          if (!shared) setShowSharePrompt(true);
        });
      },
    });
  };

  const getMealsForDate = (date: Date, mealType: string) => {
    const dateStr = formatDate(date);
    const dailyMeals = (mealPlans || []).filter(
      (plan) => plan.fecha === dateStr && plan.tipoComida === mealType
    );

    return dailyMeals.map((mealPlan) => ({
      ...mealPlan,
      recipe: mealPlan.recipe ?? undefined,
      comments: mealPlan.comments ?? [],
      pendingProposalCount: mealPlan.pendingProposalCount ?? 0,
      latestPendingProposal: mealPlan.latestPendingProposal ?? null,
    }));
  };

  // Component for meal section (lunch or dinner)
  const MealSection = ({ meals, mealType, date, label }: {
    meals: (MealPlan & { recipe?: Recipe })[];
    mealType: string;
    date: Date;
    label: string;
  }) => (
    <div className="relative">
      <div className="mb-1">
        <span className="text-xs text-tinta/50">{label}</span>
      </div>
      {meals.length > 0 ? (
        <div className="space-y-1">
          {meals.map((meal, mealIndex) => (
            <MealCard
              key={`${meal.id}-${mealIndex}`}
              meal={meal}
              onView={onViewMealPlan}
              onRequestComment={setCommentSheetMeal}
            />
          ))}

          {/* Multi-meal support - allow adding more meals to same slot */}
          <AddMealButton
            variant="append"
            onClick={() => onAddMeal(formatDate(date), mealType)}
            label="Agregar nuevo"
            className="mt-1 border-2 border-dashed border-tinta/20"
          />
        </div>
      ) : (
        <AddMealButton
          variant="empty"
          onClick={() => onAddMeal(formatDate(date), mealType)}
          label="Agregar nuevo"
          showIcon={false}
          className="border-2 border-dashed border-tinta/20"
        />
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Cargando plan semanal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The week's command center: nav, progress, review lifecycle, actions */}
      <WeekPanel
        weekStart={currentWeekStart}
        weekStartStr={weekStartStr}
        isCurrentWeek={isCurrentWeek()}
        isTransitioning={isTransitioning}
        onPreviousWeek={previousWeek}
        onNextWeek={nextWeek}
        onGoToCurrentWeek={goToCurrentWeek}
        mealPlans={mealPlans ?? []}
        review={review}
        currentUserId={currentUserId}
        isCreator={isCreator}
        isSubmitting={isSubmitting}
        isSigningOff={isSigningOff}
        onOpenPlanner={onOpenPlanner}
        onSubmit={() => setShowSubmitConfirm(true)}
        onSignoff={(verdict) => { setSignoffNote(""); setPendingSignoffVerdict(verdict); }}
      />

      {/* Keyboard navigation hint - hidden on mobile */}
      <p className="text-center hidden md:block text-xs text-tinta/50 font-medium">
        💡 Usa ← → para navegar entre semanas, Cmd/Ctrl + Home para ir a hoy
      </p>

      {/* Weekly calendar grid */}
      <div className="grid grid-cols-1 gap-3">
        {weekDates.map((date, index) => {
          const lunchMeals = getMealsForDate(date, "almuerzo");
          const dinnerMeals = getMealsForDate(date, "cena");
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          if (isWeekend && index === 5) {
            // Combine weekend days
            const sundayLunchMeals = getMealsForDate(weekDates[6], "almuerzo");
            const sundayDinnerMeals = getMealsForDate(weekDates[6], "cena");
            const isSaturdayToday = isToday(date);
            const isSundayToday = isToday(weekDates[6]);
            const isWeekendToday = isSaturdayToday || isSundayToday;
            
            return (
              <Card key="weekend" className={`rounded-xl p-4 shadow-sm transition-all ${
                isWeekendToday 
                  ? 'bg-durazno-suave border-2 border-durazno shadow-md' 
                  : 'bg-papel border border-tinta/10'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-tinta/50">SÁB-DOM</span>
                    <span className="text-lg font-semibold text-app-neutral">
                      {date.getDate()}-{weekDates[6].getDate()}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Saturday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${
                          isSaturdayToday ? 'text-app-accent' : 'text-tinta/40'
                        }`}>SÁBADO</span>
                        {isSaturdayToday && (
                          <span className="text-xs bg-app-accent text-white px-2 py-1 rounded-full font-medium">
                            HOY
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MealSection 
                        meals={lunchMeals}
                        mealType="almuerzo"
                        date={date}
                        label="Almuerzo"
                      />
                      <MealSection 
                        meals={dinnerMeals}
                        mealType="cena"
                        date={date}
                        label="Cena"
                      />
                    </div>
                  </div>
                  
                  {/* Sunday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${
                          isSundayToday ? 'text-app-accent' : 'text-tinta/40'
                        }`}>DOMINGO</span>
                        {isSundayToday && (
                          <span className="text-xs bg-app-accent text-white px-2 py-1 rounded-full font-medium">
                            HOY
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MealSection 
                        meals={sundayLunchMeals}
                        mealType="almuerzo"
                        date={weekDates[6]}
                        label="Almuerzo"
                      />
                      <MealSection 
                        meals={sundayDinnerMeals}
                        mealType="cena"
                        date={weekDates[6]}
                        label="Cena"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          } else if (!isWeekend) {
            // Regular weekday
            const isCurrentDay = isToday(date);
            return (
              <Card key={index} className={`rounded-xl p-4 shadow-sm transition-all ${
                isCurrentDay 
                  ? 'bg-durazno-suave border-2 border-durazno shadow-md' 
                  : 'bg-papel border border-tinta/10'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      isCurrentDay ? 'text-app-accent' : 'text-tinta/50'
                    }`}>
                      {getDayName(date).toUpperCase()}
                    </span>
                    <span className={`text-lg font-semibold ${
                      isCurrentDay ? 'text-app-accent' : 'text-app-neutral'
                    }`}>
                      {date.getDate()}
                    </span>
                    {isCurrentDay && (
                      <span className="text-xs bg-app-accent text-white px-2 py-1 rounded-full font-medium">
                        HOY
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MealSection 
                    meals={lunchMeals}
                    mealType="almuerzo"
                    date={date}
                    label="Almuerzo"
                  />
                  <MealSection 
                    meals={dinnerMeals}
                    mealType="cena"
                    date={date}
                    label="Cena"
                  />
                </div>
              </Card>
            );
          }
          return null;
        })}
      </div>

      {/* Meal Comment Sheet */}
      <MealCommentSheet
        mealPlanId={commentSheetMeal?.mealPlanId ?? 0}
        recipeId={commentSheetMeal?.recipeId ?? 0}
        recipeName={commentSheetMeal?.recipeName ?? ""}
        mealDate={commentSheetMeal?.fecha}
        isOpen={!!commentSheetMeal}
        onClose={() => setCommentSheetMeal(null)}
      />

      {/* Submit for review confirmation */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {review ? "¿Reenviar esta semana para revisión?" : "¿Enviar esta semana para revisión?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará un email al resto de la familia avisándoles que pueden revisar el menú de la semana del{" "}
              {formatEnhancedWeekRange(currentWeekStart).range}, y se abre el menú para compartirles el link
              por WhatsApp o la app que quieras.
              {review && " La revisión anterior y las aprobaciones serán reemplazadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                // Radix closes the dialog on action click by default; keep it
                // open until the submit request settles (see handleSubmitAndShare).
                event.preventDefault();
                handleSubmitAndShare();
              }}
              className="bg-app-accent hover:bg-app-accent/90 text-slate-900"
            >
              {isSubmitting
                ? "Enviando…"
                : review
                ? "Reenviar y compartir"
                : "Enviar y compartir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share fallback — only when the share sheet couldn't open right after
          submitting (gesture expired / popup blocked). A fresh tap always works. */}
      <AlertDialog open={showSharePrompt} onOpenChange={setShowSharePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Semana enviada 🎉</AlertDialogTitle>
            <AlertDialogDescription>
              Avisale a la familia: compartí el link de revisión por WhatsApp o la app que prefieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Listo</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void shareReviewNow();
                setShowSharePrompt(false);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Compartir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Commentator sign-off confirmation */}
      <AlertDialog
        open={pendingSignoffVerdict !== null}
        onOpenChange={(open) => { if (!open) { setPendingSignoffVerdict(null); setSignoffNote(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSignoffVerdict === "approved"
                ? "¿Aprobar el menú de la semana?"
                : "¿Pedir cambios al menú de la semana?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSignoffVerdict === "approved"
                ? "Se le avisará a quien armó el menú que diste el visto bueno. Podés agregar un comentario opcional."
                : "Se le avisará a quien armó el menú que querés cambios. Contale qué te gustaría ajustar (opcional)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={signoffNote}
            onChange={(e) => setSignoffNote(e.target.value)}
            placeholder={pendingSignoffVerdict === "approved" ? "¡Buenísimo el menú!" : "Cambiaría el martes por algo más liviano…"}
            maxLength={500}
            className="text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOff}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSigningOff || pendingSignoffVerdict === null}
              onClick={() => {
                if (pendingSignoffVerdict) {
                  const trimmed = signoffNote.trim();
                  submitSignoff({ verdict: pendingSignoffVerdict, note: trimmed || undefined });
                }
                setPendingSignoffVerdict(null);
                setSignoffNote("");
              }}
              className={
                pendingSignoffVerdict === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }
            >
              {pendingSignoffVerdict === "approved" ? "Aprobar" : "Pedir cambios"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}