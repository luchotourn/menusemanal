import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMealComments, useRecipeRating } from "@/hooks/use-meal-comments";
import { useMealProposals } from "@/hooks/use-meal-proposals";
import { useQuery } from "@tanstack/react-query";
import { Send, Sparkles, ArrowLeftRight, ChevronLeft, Search } from "lucide-react";
import type { Recipe } from "@shared/schema";
import { isPastMealDate } from "@shared/utils";
import { resolveApiUrl } from "@/lib/queryClient";

interface MealCommentSheetProps {
  mealPlanId: number;
  recipeId: number;
  recipeName: string;
  /** YYYY-MM-DD; when in the past, the swap-proposal CTA is hidden */
  mealDate?: string;
  isOpen: boolean;
  onClose: () => void;
}

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

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClick = (star: number) => {
    if (disabled) return;
    const newValue = star === localValue ? 0 : star;
    setLocalValue(newValue);
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

function ProposeRecipeView({
  currentRecipeId,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  currentRecipeId: number;
  onSubmit: (recipeId: number, reason: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [reason, setReason] = useState("");

  const { data: recipes, isLoading } = useQuery({
    queryKey: ["/api/recipes", { search: searchQuery, propose: true }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(resolveApiUrl(`/api/recipes?${params}`), { credentials: "include" });
      if (!response.ok) throw new Error("Error al cargar las recetas");
      return response.json() as Promise<Recipe[]>;
    },
  });

  const filtered = (recipes ?? []).filter((r) => r.id !== currentRecipeId);

  if (selectedRecipe) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <button
          type="button"
          onClick={() => setSelectedRecipe(null)}
          className="flex items-center gap-1 text-xs text-purple-600 font-medium pb-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Cambiar comida
        </button>
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3 mb-3">
          <p className="text-xs text-gray-500 mb-1">Vas a proponer reemplazar por:</p>
          <p className="text-sm font-semibold text-gray-900">{selectedRecipe.nombre}</p>
        </div>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="¿Por qué? (opcional)"
          maxLength={500}
          rows={3}
          className="resize-none text-sm rounded-xl border-gray-200 focus:border-purple-300 focus:ring-purple-200 mb-3"
        />
        <div className="flex gap-2 mt-auto">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onSubmit(selectedRecipe.id, reason.trim())}
            disabled={isSubmitting}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            Enviar propuesta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 text-xs text-purple-600 font-medium pb-2"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Volver
      </button>
      <p className="text-sm font-semibold text-gray-700 mb-2">Elegí una comida del recetario</p>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar recetas..."
          className="pl-9 text-sm rounded-xl"
          autoComplete="off"
        />
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
        {isLoading && <p className="text-xs text-gray-400 text-center py-4">Cargando...</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No hay recetas.</p>
        )}
        {filtered.map((recipe) => (
          <button
            key={recipe.id}
            type="button"
            onClick={() => setSelectedRecipe(recipe)}
            className="w-full text-left rounded-xl border border-gray-200 bg-white px-3 py-2.5 hover:bg-purple-50 hover:border-purple-200 transition-colors"
          >
            <p className="text-sm font-semibold text-gray-900 leading-tight">{recipe.nombre}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{recipe.categoria}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Commentator-only action sheet — rate, comment, or propose a swap.
 * Read-only views (existing comments, proposal status) live in MealPlanDetailModal,
 * which the calendar opens on card body click. This sheet is an action surface, not a feed.
 */
export function MealCommentSheet({
  mealPlanId,
  recipeId,
  recipeName,
  mealDate,
  isOpen,
  onClose,
}: MealCommentSheetProps) {
  const [commentText, setCommentText] = useState("");
  const [view, setView] = useState<"main" | "propose">("main");
  const isPastMeal = mealDate ? isPastMealDate(mealDate) : false;

  const { submitComment, isSubmitting } = useMealComments(
    isOpen ? mealPlanId : undefined
  );
  const { currentRating, submitRating, isSubmittingRating } = useRecipeRating(
    isOpen ? recipeId : undefined
  );
  const { createProposal, isCreating } = useMealProposals(
    isOpen ? mealPlanId : undefined
  );

  // Reset to main view + clear input whenever the sheet (re)opens
  useEffect(() => {
    if (isOpen) {
      setView("main");
      setCommentText("");
    }
  }, [isOpen]);

  const canSubmit = !isSubmitting && commentText.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitComment(
      { comment: commentText.trim() },
      {
        onSuccess: () => {
          setCommentText("");
          onClose();
        },
      }
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col rounded-t-3xl px-4 pb-6"
      >
        <SheetHeader className="pt-2 pb-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-purple-500" />
            {recipeName}
          </SheetTitle>
          <SheetDescription className="text-xs text-gray-400">
            {view === "main"
              ? "Calificá, comentá o proponé un cambio"
              : "Proponer otra comida"}
          </SheetDescription>
        </SheetHeader>

        {view === "propose" ? (
          <ProposeRecipeView
            currentRecipeId={recipeId}
            isSubmitting={isCreating}
            onCancel={() => setView("main")}
            onSubmit={(id, reason) => {
              createProposal(
                { proposedRecipeId: id, reason: reason || undefined },
                { onSuccess: () => onClose() }
              );
            }}
          />
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-4 pt-2">
            {/* 1. Star rating */}
            <div className="pb-3 border-b border-purple-100/60">
              <InteractiveStarRating
                value={currentRating}
                onChange={(r) => submitRating(r)}
                disabled={isSubmittingRating}
              />
            </div>

            {/* 2. Comment input */}
            <div>
              <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase mb-2">
                Dejar una opinión
              </p>
              <div className="flex gap-2">
                <Textarea
                  placeholder="¿Qué pensás de esta comida?"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={500}
                  rows={3}
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
                  aria-label="Enviar comentario"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 3. Propose-swap CTA — hidden for past meals (server enforces too) */}
            {!isPastMeal && (
              <div className="pt-1 mt-auto">
                <Button
                  variant="outline"
                  onClick={() => setView("propose")}
                  className="w-full border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  Proponer otra comida
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
