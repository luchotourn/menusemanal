import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

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

  // Mobile keyboard detection and viewport adjustment
  useEffect(() => {
    if (!isOpen) return;

    const handleVisualViewportChange = () => {
      if (typeof window !== "undefined" && window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;
        
        setKeyboardHeight(keyboardHeight);
        
        // Auto-scroll to search results when keyboard appears
        if (keyboardHeight > 0 && isSearchFocused && resultsRef.current) {
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      }
    };

    const handleResize = () => {
      // Fallback for browsers without visualViewport support
      if (!window.visualViewport) {
        const currentHeight = window.innerHeight;
        const originalHeight = window.screen.height;
        const heightDiff = originalHeight - currentHeight;
        
        if (heightDiff > 150) { // Likely keyboard is open
          setKeyboardHeight(heightDiff);
        } else {
          setKeyboardHeight(0);
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isSearchFocused, isOpen]);

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    setKeyboardHeight(0);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-lg mx-auto overflow-hidden p-0"
        style={{
          maxHeight: keyboardHeight > 0 ? `calc(100vh - ${keyboardHeight}px)` : '90vh'
        }}
      >
        {/* Sticky Header */}
        <DialogHeader className={`sticky top-0 z-50 bg-white border-b border-gray-100 p-4 ${
          isSearchFocused ? 'sticky-search' : ''
        }`}>
          <DialogTitle className={`font-semibold text-app-neutral transition-all duration-200 ${
            isSearchFocused && keyboardHeight > 0 ? 'text-base' : 'text-lg'
          }`}>
            Elegir Comida para {mealTypeLabel}
          </DialogTitle>
          {!(isSearchFocused && keyboardHeight > 0) && (
            <p className="text-sm text-gray-600 capitalize">
              {dateLabel}
            </p>
          )}
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          {/* Search - Sticky when focused */}
          <div className={`mobile-search-container ${isSearchFocused ? 'sticky top-20 z-40 bg-white border-b border-gray-100' : ''} p-4 transition-all duration-200`}>
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              placeholder="Buscar comidas..."
              className="bg-gray-50 border-0 focus:bg-white text-base"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </div>

          {/* Recipes List - Scrollable container when keyboard is open */}
          <div 
            ref={resultsRef}
            className={`flex-1 px-4 transition-all duration-200 ${
              keyboardHeight > 0 ? 'overflow-y-auto keyboard-open-results pb-4' : 'pb-4'
            }`}
            style={{
              maxHeight: keyboardHeight > 0 ? `calc(100vh - 180px - ${keyboardHeight}px)` : 'auto'
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
        </div>
      </DialogContent>
    </Dialog>
  );
}