import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reactions } from "@/components/commentator/emoji-reactions";
import { CommentatorOnly, CreatorOnly } from "@/components/role-based-wrapper";
import { useMealComments, useRecipeRating } from "@/hooks/use-meal-comments";
import { Send, Sparkles } from "lucide-react";

interface MealCommentSheetProps {
  mealPlanId: number;
  recipeId: number;
  recipeName: string;
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_MAP = Object.fromEntries(reactions.map(r => [r.value, r.emoji]));

const STAR_LABELS = ['', 'Malo', 'Regular', 'Bueno', '¡Rico!', '¡Me encanta!'];

/** Large, tactile star rating for kid-friendly interaction */
function InteractiveStarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [hoverValue, setHoverValue] = useState(0);
  const [popStar, setPopStar] = useState<number | null>(null);

  // Sync local state when server value arrives or changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClick = (star: number) => {
    if (disabled) return;
    const newValue = star === localValue ? 0 : star;
    setLocalValue(newValue); // Instant visual feedback
    onChange(newValue);
    setPopStar(star);
    setTimeout(() => setPopStar(null), 400);
  };

  const displayValue = hoverValue || localValue;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
        ¿Qué te pareció?
      </p>
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            className={`
              w-12 h-12 flex items-center justify-center rounded-xl
              transition-all duration-200 ease-out select-none
              ${popStar === star ? 'scale-125' : ''}
              ${!disabled ? 'hover:scale-110 active:scale-90 cursor-pointer' : 'cursor-default opacity-60'}
            `}
            style={{
              fontSize: '2rem',
              lineHeight: 1,
              color: star <= displayValue ? '#fbbf24' : '#e5e7eb',
              filter: star <= displayValue ? 'drop-shadow(0 2px 6px rgba(251,191,36,0.5))' : 'none',
            }}
            onMouseEnter={() => !disabled && setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
            onClick={() => handleClick(star)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="h-5 flex items-center">
        {displayValue > 0 && (
          <span className="text-xs font-semibold text-amber-600 tracking-wide">
            {STAR_LABELS[displayValue]}
          </span>
        )}
      </div>
    </div>
  );
}

export function MealCommentSheet({
  mealPlanId,
  recipeId,
  recipeName,
  isOpen,
  onClose,
}: MealCommentSheetProps) {
  const [commentText, setCommentText] = useState("");
  const { comments, isLoading, submitComment, isSubmitting } = useMealComments(
    isOpen ? mealPlanId : undefined
  );
  const { currentRating, submitRating, isSubmittingRating } = useRecipeRating(
    isOpen ? recipeId : undefined
  );

  const canSubmit = !isSubmitting && commentText.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitComment(
      { comment: commentText.trim() },
      { onSuccess: () => setCommentText("") }
    );
  };

  const handleRatingChange = (rating: number) => {
    submitRating(rating);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col rounded-t-3xl px-4 pb-6"
      >
        {/* Header */}
        <SheetHeader className="pt-2 pb-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-purple-500" />
            {recipeName}
          </SheetTitle>
          <SheetDescription className="text-xs text-gray-400">
            Opiniones de la familia sobre esta comida
          </SheetDescription>
        </SheetHeader>

        {/* Star rating section — commentators only, always visible at top */}
        <CommentatorOnly>
          <div className="py-3 border-b border-purple-100/60">
            <InteractiveStarRating
              value={currentRating}
              onChange={handleRatingChange}
              disabled={isSubmittingRating}
            />
          </div>
        </CommentatorOnly>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4 min-h-0">
          {isLoading && (
            <p className="text-sm text-gray-400 text-center py-4">
              Cargando opiniones...
            </p>
          )}
          {!isLoading && comments.length === 0 && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💬</span>
              </div>
              <p className="text-sm text-gray-400 font-medium">
                Todavía no hay opiniones
              </p>
              <p className="text-xs text-gray-300 mt-1">
                ¡Sé el primero en opinar!
              </p>
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm">
                {c.userName?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 bg-purple-50/60 rounded-2xl px-3.5 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-gray-700">
                    {c.userName}
                  </span>
                  {c.emoji && (
                    <span className="text-base leading-none">
                      {EMOJI_MAP[c.emoji] ?? c.emoji}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {formatTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-snug">{c.comment}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input area — commentators only */}
        <CommentatorOnly>
          <div className="border-t border-gray-100 pt-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Escribe tu opinión..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                maxLength={500}
                rows={2}
                className="resize-none text-sm flex-1 rounded-xl border-gray-200 focus:border-purple-300 focus:ring-purple-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                size="icon"
                className="bg-purple-600 hover:bg-purple-700 text-white h-auto self-end rounded-xl shadow-md"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CommentatorOnly>

        {/* View-only notice for creators */}
        <CreatorOnly>
          {comments.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs text-gray-400 text-center">
                Solo los chicos pueden dejar opiniones
              </p>
            </div>
          )}
        </CreatorOnly>
      </SheetContent>
    </Sheet>
  );
}
