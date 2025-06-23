import { useState } from "react";
import { X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const handleSelectRecipe = (recipe: Recipe) => {
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
      <DialogContent className="max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white border-b border-gray-100 p-4 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-semibold text-app-neutral">
              Elegir Receta para {mealTypeLabel}
            </DialogTitle>
            <p className="text-sm text-gray-600 capitalize">
              {dateLabel}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="text-gray-600 w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <div className="p-4">
          {/* Search */}
          <div className="mb-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar recetas..."
              className="bg-gray-50 border-0 focus:bg-white"
            />
          </div>

          {/* Recipes List */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando recetas...</p>
            </div>
          ) : recipes && recipes.length > 0 ? (
            <div className="space-y-3">
              {recipes.map((recipe) => (
                <div key={recipe.id} onClick={() => handleSelectRecipe(recipe)}>
                  <RecipeCard 
                    recipe={recipe} 
                    onClick={() => handleSelectRecipe(recipe)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-app-neutral mb-2">
                No se encontraron recetas
              </h3>
              <p className="text-gray-500 mb-4">
                Intenta con otros términos de búsqueda
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}