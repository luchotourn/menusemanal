import { useState, useEffect, useRef } from "react";
import { ResponsiveModal, useDragToDismiss } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "@/components/recipe-card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

interface MealSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  mealType: string;
}

export function MealSelectionModal({ isOpen, onClose, selectedDate, mealType }: MealSelectionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset search state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset to passive state when modal opens
      setIsSearchActive(false);
      setSearchQuery("");
      setKeyboardHeight(0);
    }
  }, [isOpen]);

  const { data: recipes, isLoading } = useQuery({
    queryKey: ["/api/recipes", { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/recipes?${params}`);
      if (!response.ok) throw new Error("Error al cargar las recetas");
      return response.json() as Promise<Recipe[]>;
    },
  });

  const addToWeekMutation = useMutation({
    mutationFn: async ({ recipeId }: { recipeId: number }) => {
      const response = await apiRequest("POST", "/api/meal-plans", {
        fecha: selectedDate,
        recetaId: recipeId,
        tipoComida: mealType
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      toast({ title: `¡Receta agregada al ${mealType === "almuerzo" ? "almuerzo" : "cena"}!` });
      onClose();
    },
    onError: () => {
      toast({ title: "Error al agregar la receta al plan", variant: "destructive" });
    },
  });

  // Mobile keyboard detection - only when search is active
  useEffect(() => {
    if (!isOpen || !isSearchActive) return;

    const handleVisualViewportChange = () => {
      if (typeof window !== "undefined" && window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;
        setKeyboardHeight(keyboardHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, [isSearchActive, isOpen]);

  const handleSearchClick = () => {
    setIsSearchActive(true);
    // Focus after state update
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSearchBlur = () => {
    // Don't immediately deactivate search to allow typing
    setTimeout(() => {
      if (searchQuery === "") {
        setIsSearchActive(false);
        setKeyboardHeight(0);
      }
    }, 100);
  };

  const handleModalClose = () => {
    // Ensure clean state when closing
    setIsSearchActive(false);
    setSearchQuery("");
    setKeyboardHeight(0);
    onClose();
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    // Prevent double submission if already pending
    if (addToWeekMutation.isPending) return;
    addToWeekMutation.mutate({ recipeId: recipe.id });
  };

  const mealTypeLabel = mealType === "almuerzo" ? "Almuerzo" : "Cena";
  const dateLabel = new Date(selectedDate).toLocaleDateString('es-AR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <ResponsiveModal 
      isOpen={isOpen} 
      onClose={handleModalClose}
      title={`Elegir Comida para ${mealTypeLabel}`}
      subtitle={!isSearchActive ? dateLabel : undefined}
      className="p-0"
    >
      {/* Search Input - Only focusable when clicked */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        {!isSearchActive ? (
          // Passive search box - shows placeholder, no focus
          <div
            onClick={handleSearchClick}
            className="bg-gray-50 border-0 rounded-md px-3 py-2 text-gray-500 cursor-pointer"
          >
            Buscar comidas...
          </div>
        ) : (
          // Active search input
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={handleSearchBlur}
            placeholder="Buscar comidas..."
            className="bg-gray-50 border-0 focus:bg-white text-base"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        )}
      </div>

      {/* Simple Scrollable Content */}
      <div 
        ref={resultsRef}
        className="overflow-y-auto px-4 py-4"
        style={{
          height: isSearchActive && keyboardHeight > 0 ? '250px' : '400px',
          WebkitOverflowScrolling: 'touch'
        }}
      >
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando comidas...</p>
            </div>
          ) : recipes && recipes.length > 0 ? (
            <div className="space-y-3">
              {recipes.map((recipe) => (
                <RecipeCard 
                  key={recipe.id}
                  recipe={recipe} 
                  onClick={() => handleSelectRecipe(recipe)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-app-neutral mb-2">
                No se encontraron comidas
              </h3>
              <p className="text-gray-500 mb-4">
                Intenta con otros términos de búsqueda
              </p>
            </div>
          )}
        </div>
    </ResponsiveModal>
  );
}