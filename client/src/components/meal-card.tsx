import { ArrowLeftRight, MessageCircle } from "lucide-react";
import type { MealCommentInline, MealPlan, Recipe } from "@shared/schema";
import { useMealAchievements } from "@/hooks/use-meal-achievements";
import { useUserRole } from "@/components/role-based-wrapper";
import { getDishEmoji, mealProposalChipLabel, type PendingProposalSummary } from "@/components/meal-card-utils";

export type MealCardMeal = MealPlan & {
  recipe?: Recipe;
  comments?: MealCommentInline[];
  pendingProposalCount?: number;
  latestPendingProposal?: PendingProposalSummary | null;
};

export type MealCommentRequest = {
  mealPlanId: number;
  recipeId: number;
  recipeName: string;
  fecha: string;
};

interface MealCardProps {
  meal: MealCardMeal;
  onView: (meal: MealCardMeal) => void;
  onRequestComment: (payload: MealCommentRequest) => void;
}

function KidStars({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-xs ${i < rating ? "text-amber-600" : "text-tinta/20"}`}>
          ★
        </span>
      ))}
    </div>
  );
}

// MealCard — emoji tile + title + (when pending) Cambio chip + (commentator only)
// chat icon + inline comments. Card body opens the detail modal; chat icon opens
// the comment/propose sheet (commentators only).
export function MealCard({ meal, onView, onRequestComment }: MealCardProps) {
  const { isCreator } = useUserRole();
  const recipe = meal.recipe;
  const comments = meal.comments ?? [];
  const hasPendingProposal = (meal.pendingProposalCount ?? 0) > 0;
  const proposal = meal.latestPendingProposal ?? null;
  const { mealAchievements } = useMealAchievements(meal.id);
  const userAchievement = mealAchievements[0];

  if (!recipe) {
    return (
      <div className="bg-red-50 rounded-xl rounded-tr-[22px] p-3 cursor-pointer hover:bg-red-100 transition-colors min-h-[44px] flex items-center">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-600 truncate">
            Receta no encontrada
          </p>
        </div>
      </div>
    );
  }

  const chipLabel = mealProposalChipLabel(meal.pendingProposalCount ?? 0, proposal);

  return (
    <div
      className={`rounded-xl rounded-tr-[22px] p-3 cursor-pointer transition-all shadow-sm min-h-[88px] border ${
        hasPendingProposal
          ? "bg-durazno-suave border-durazno hover:brightness-[0.98]"
          : "bg-crema border-tinta/5 hover:brightness-[0.98]"
      }`}
      onClick={() => onView(meal)}
    >
      <div className="flex flex-col gap-2">
        {/* Emoji tile + recipe name — allow two lines for long Spanish names */}
        <div className="flex items-start gap-2">
          <span className="text-lg leading-none mt-0.5" aria-hidden="true">
            {getDishEmoji(recipe.nombre, recipe.categoria)}
          </span>
          <p className="text-sm font-semibold text-tinta leading-tight line-clamp-2">
            {recipe.nombre}
          </p>
        </div>

        {/* Footer row: proposal chip OR ratings/favorite (left) + chat icon (commentator only, right) */}
        <div className="flex items-center justify-between gap-2">
          {hasPendingProposal ? (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-durazno/60 border border-durazno text-amber-900 text-[11px] font-semibold min-w-0"
              title={proposal ? `${proposal.proposerName} propuso: ${proposal.proposedRecipeName}` : "Hay una propuesta de cambio pendiente"}
            >
              <ArrowLeftRight className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{chipLabel}</span>
            </span>
          ) : (
            <div className="flex items-center gap-1 min-h-[18px]">
              {(recipe.calificacionNinos ?? 0) > 0 ? (
                <KidStars rating={recipe.calificacionNinos ?? 0} />
              ) : null}
              {Boolean(recipe.esFavorita) ? (
                <span className="text-xs text-brasa font-medium">⭐</span>
              ) : null}
            </div>
          )}

          {!isCreator && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestComment({
                  mealPlanId: meal.id,
                  recipeId: recipe.id,
                  recipeName: recipe.nombre,
                  fecha: meal.fecha,
                });
              }}
              className={`
                flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0
                transition-all duration-150 active:scale-90 shadow-sm
                ${userAchievement?.leftFeedback === 1
                  ? "bg-purple-200 border border-purple-300/60"
                  : "bg-purple-50 border border-purple-200/60 hover:bg-purple-100"
                }
              `}
              title="Comentar o proponer un cambio"
              aria-label="Comentar o proponer un cambio"
            >
              <MessageCircle
                className={`w-[18px] h-[18px] ${
                  userAchievement?.leftFeedback === 1
                    ? "text-purple-600 fill-purple-200"
                    : "text-purple-400"
                }`}
              />
            </button>
          )}
        </div>

        {/* Inline comments (PR #63) — visible to everyone (the cook reads them while preparing) */}
        {comments.length > 0 && (
          <div className={`border-t pt-2 space-y-1.5 ${hasPendingProposal ? "border-durazno/50" : "border-tinta/10"}`}>
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-1.5 leading-snug">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-uva text-white text-[9px] font-bold flex-shrink-0 mt-0.5">
                  {c.userName?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
                <p className="text-[11px] text-tinta/80 flex-1 line-clamp-2">
                  {c.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
