import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Send, CheckCircle2, ThumbsUp, AlertTriangle, Clock, Sparkles, Share2 } from "lucide-react";
import { AddMealButton } from "@/components/add-meal-button";
import { Button } from "@/components/ui/button";
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
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { formatWeekRange, formatEnhancedWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import { parseWeekParam, weekParamToDate, buildReviewShareMessage, openShareUi } from "@/lib/review-share";
import type { MealCommentInline, MealPlan, Recipe } from "@shared/schema";
import { MealCard } from "@/components/meal-card";
import type { PendingProposalSummary } from "@/components/meal-card-utils";
import { MealCommentSheet } from "@/components/meal-comment-sheet";
import { CreatorOnly, CommentatorOnly, useUserRole } from "@/components/role-based-wrapper";
import { useWeeklyReview } from "@/hooks/use-weekly-review";
import { useProfile } from "@/hooks/useAuth";
import { selectReviewNotes, reviewReviewerName } from "@shared/utils";

type MealPlanWithCommentsAndRecipe = MealPlan & {
  recipe: Recipe | null;
  comments: MealCommentInline[];
  pendingProposalCount: number;
  latestPendingProposal: PendingProposalSummary | null;
};

interface WeeklyCalendarProps {
  onAddMeal: (date: string, mealType: string) => void;
  onViewMealPlan: (mealPlan: MealPlan & { recipe?: Recipe; comments?: MealCommentInline[] }) => void;
  onGenerateWeek?: (weekStart: Date) => void;
}

export function WeeklyCalendar({ onAddMeal, onViewMealPlan, onGenerateWeek }: WeeklyCalendarProps) {
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
        <span className="text-xs text-gray-500">{label}</span>
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
            className="mt-1 border-2 border-dashed border-gray-300"
          />
        </div>
      ) : (
        <AddMealButton
          variant="empty"
          onClick={() => onAddMeal(formatDate(date), mealType)}
          label="Agregar nuevo"
          showIcon={false}
          className="border-2 border-dashed border-gray-300"
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
      {/* Responsive Header with week navigation */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 shadow-sm lg:p-6 md:p-4 p-3">
        <div className="flex items-center justify-between lg:mb-4 md:mb-3 mb-2">
          <div className="flex items-center lg:space-x-4 md:space-x-3 space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:p-3 md:p-2.5 p-2 rounded-xl hover:bg-slate-200/50 hover:scale-105 transition-all duration-200 shadow-sm border border-slate-200/50"
              onClick={previousWeek}
              disabled={isTransitioning}
            >
              <ChevronLeft className="text-slate-700 lg:w-6 lg:h-6 md:w-5 md:h-5 w-4 h-4" />
            </Button>
            
            <div className={`text-center transition-all duration-200 ${isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
              {(() => {
                const weekInfo = formatEnhancedWeekRange(currentWeekStart);
                return (
                  <div className="lg:space-y-1 md:space-y-1 space-y-0.5">
                    <div className="flex items-center lg:space-x-2 md:space-x-2 space-x-1">
                      <Calendar className="lg:w-4 lg:h-4 md:w-4 md:h-4 w-3 h-3 text-slate-600" />
                      <span className="lg:text-lg md:text-base text-sm font-bold text-slate-900 lg:min-w-[160px] md:min-w-[140px] min-w-[120px]">
                        {weekInfo.range}
                      </span>
                    </div>
                    <div className="flex items-center justify-center lg:space-x-3 md:space-x-2 space-x-1 lg:text-xs md:text-xs text-[10px] text-slate-600">
                      <span className="hidden md:inline">{weekInfo.monthContext}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="lg:p-3 md:p-2.5 p-2 rounded-xl hover:bg-slate-200/50 hover:scale-105 transition-all duration-200 shadow-sm border border-slate-200/50"
              onClick={nextWeek}
              disabled={isTransitioning}
            >
              <ChevronRight className="text-slate-700 lg:w-6 lg:h-6 md:w-5 md:h-5 w-4 h-4" />
            </Button>
          </div>
          
          {!isCurrentWeek() && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToCurrentWeek}
              className="bg-white/80 hover:bg-white border-slate-300 text-slate-700 hover:text-slate-800 font-medium lg:text-sm md:text-sm text-xs lg:px-3 md:px-2.5 px-2"
            >
              <span className="hidden sm:inline">Ir a hoy</span>
              <span className="sm:hidden">Hoy</span>
            </Button>
          )}
        </div>
        
        {/* Review status + submit action.
            The status is a single adaptive element: a compact pill when there
            is nothing more to say, or — when commentators left notes — one
            consolidated block whose header states the verdict once and quotes
            the note(s) beneath it. This avoids repeating the icon/reviewer. */}
        <div className="flex items-start justify-between gap-2 mt-2 mb-1">
          {review ? (
            (() => {
              const tone = {
                approved: { text: "text-emerald-700", note: "text-emerald-800", bg: "bg-emerald-50", border: "border-emerald-200", Icon: ThumbsUp },
                changes_requested: { text: "text-amber-700", note: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200", Icon: AlertTriangle },
                submitted: { text: "text-sky-700", note: "text-sky-800", bg: "bg-sky-50", border: "border-sky-200", Icon: Clock },
              }[review.status];
              const { Icon } = tone;

              const label =
                review.status === "submitted"
                  ? `En revisión · enviada ${formatDistanceToNow(new Date(review.submittedAt), { addSuffix: true, locale: es })}`
                  : `${review.status === "approved" ? "Aprobada por" : "Cambios pedidos por"} ${reviewReviewerName(review.status, review.signoffs, review.lastReviewedBy)}`;

              const tooltip =
                review.status === "submitted"
                  ? `Enviada el ${new Date(review.submittedAt).toLocaleString("es-AR")}`
                  : review.lastReviewedAt
                  ? `${review.status === "approved" ? "Aprobada" : "Cambios pedidos"} el ${new Date(review.lastReviewedAt).toLocaleString("es-AR")}`
                  : undefined;

              const notes = selectReviewNotes(review.signoffs);

              // No note → compact pill.
              if (notes.length === 0) {
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${tone.text} ${tone.bg} border ${tone.border}`}
                    title={tooltip}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </span>
                );
              }

              // Has note(s) → consolidated status + feedback block. The header
              // names the reviewer once; a single note then needs no author
              // prefix, while multiple notes keep theirs to stay distinguishable.
              const showAuthors = notes.length > 1;
              return (
                <div className={`min-w-0 rounded-lg border px-3 py-2 ${tone.bg} ${tone.border}`} title={tooltip}>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${tone.text}`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {notes.map((s) => (
                      <li key={s.id} className={`text-xs leading-snug break-words ${tone.note}`}>
                        {showAuthors && <span className="font-medium">{s.userName}: </span>}
                        <span className="italic">«{s.note}»</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()
          ) : (
            <span className="text-xs text-slate-500">
              {mealPlans && mealPlans.length > 0
                ? `${mealPlans.length} comida${mealPlans.length === 1 ? "" : "s"} planeada${mealPlans.length === 1 ? "" : "s"}`
                : "Sin comidas planeadas"}
            </span>
          )}

          <CreatorOnly>
            <div className="flex items-center gap-2 shrink-0">
              {onGenerateWeek && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateWeek(currentWeekStart)}
                  className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50 font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Generar semana
                </Button>
              )}
              <Button
                variant={review ? "outline" : "default"}
                size="sm"
                onClick={() => setShowSubmitConfirm(true)}
                disabled={isSubmitting || (mealPlans?.length ?? 0) === 0}
                className={
                  review
                    ? "text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                    : "text-xs bg-app-accent hover:bg-app-accent/90 text-slate-900 font-medium"
                }
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {review ? "Reenviar" : "Enviar para revisión"}
              </Button>
            </div>
          </CreatorOnly>
        </div>

        {/* Commentator sign-off buttons — only when the week is awaiting review
            and this commentator has not yet signed off. Lets the commentator
            close the loop with an explicit "approve" or "request changes". */}
        {review && (() => {
          const mySignoff = currentUserId != null
            ? review.signoffs.find((s) => s.userId === currentUserId)
            : undefined;
          return (
            <CommentatorOnly>
              <div className="flex items-center justify-between gap-2 mb-1">
                {mySignoff ? (
                  <span className="text-xs text-slate-600">
                    {mySignoff.verdict === "approved"
                      ? "Aprobaste esta semana"
                      : "Pediste cambios en esta semana"}
                    {mySignoff.note ? ` · "${mySignoff.note}"` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">¿Cómo se ve la semana?</span>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSigningOff}
                    onClick={() => { setSignoffNote(""); setPendingSignoffVerdict("changes_requested"); }}
                    className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Pedir cambios
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSigningOff}
                    onClick={() => { setSignoffNote(""); setPendingSignoffVerdict("approved"); }}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                    Aprobar semana
                  </Button>
                </div>
              </div>
            </CommentatorOnly>
          );
        })()}

        {/* Keyboard navigation hint - hidden on mobile */}
        <div className="text-center hidden md:block">
          <p className="text-xs text-slate-600/70 font-medium">
            💡 Usa ← → para navegar entre semanas, Cmd/Ctrl + Home para ir a hoy
          </p>
        </div>
      </div>

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
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-app-accent shadow-md' 
                  : 'bg-white border border-gray-100'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">SÁB-DOM</span>
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
                          isSaturdayToday ? 'text-app-accent' : 'text-gray-400'
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
                          isSundayToday ? 'text-app-accent' : 'text-gray-400'
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
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-app-accent shadow-md' 
                  : 'bg-white border border-gray-100'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      isCurrentDay ? 'text-app-accent' : 'text-gray-500'
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