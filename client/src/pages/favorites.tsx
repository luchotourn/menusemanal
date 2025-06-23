import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import { Header } from "@/components/header";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeDetailModal } from "@/components/recipe-detail-modal";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

export default function Favorites() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const { data: favoriteRecipes, isLoading } = useQuery({
    queryKey: ["/api/recipes", { favorites: true }],
    queryFn: async () => {
      const response = await fetch("/api/recipes?favorites=true");
      if (!response.ok) throw new Error("Error al cargar las recetas favoritas");
      return response.json() as Promise<Recipe[]>;
    },
  });

  const addToWeekMutation = useMutation({
    mutationFn: async ({ recipeId, date }: { recipeId: number; date: string }) => {
      const response = await apiRequest("POST", "/api/meal-plans", {
        fecha: date,
        recetaId: recipeId,
        tipoComida: "principal"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      toast({ title: "¡Receta agregada al plan semanal!" });
      setShowRecipeModal(false);
    },
    onError: () => {
      toast({ title: "Error al agregar la receta al plan", variant: "destructive" });
    },
  });

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeModal(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeModal(false);
    setShowAddRecipe(true);
  };

  const handleAddToWeek = (recipe: Recipe) => {
    // For now, add to today's date. In a real app, you might want to show a date picker
    const today = new Date().toISOString().split('T')[0];
    addToWeekMutation.mutate({ recipeId: recipe.id, date: today });
  };

  // Group recipes by rating
  const recipesByRating = favoriteRecipes?.reduce((acc, recipe) => {
    const rating = recipe.calificacionNinos || 0;
    if (!acc[rating]) acc[rating] = [];
    acc[rating].push(recipe);
    return acc;
  }, {} as Record<number, Recipe[]>) || {};

  const ratingLabels = {
    5: "¡Les encanta! ⭐⭐⭐⭐⭐",
    4: "Les gusta mucho ⭐⭐⭐⭐",
    3: "Les gusta ⭐⭐⭐",
    2: "Está bien ⭐⭐",
    1: "No les gusta ⭐"
  };

  return (
    <div className="min-h-screen bg-app-background">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 pb-20">
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-6">
            <Heart className="text-app-primary w-6 h-6 fill-current" />
            <h2 className="text-2xl font-bold text-app-neutral">Favoritas de los Chicos</h2>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando recetas favoritas...</p>
            </div>
          ) : favoriteRecipes && favoriteRecipes.length > 0 ? (
            <div className="space-y-6">
              {/* Group by rating, highest first */}
              {[5, 4, 3, 2, 1].map(rating => {
                const recipes = recipesByRating[rating];
                if (!recipes || recipes.length === 0) return null;

                return (
                  <div key={rating}>
                    <h3 className="text-lg font-semibold text-app-neutral mb-3">
                      {ratingLabels[rating as keyof typeof ratingLabels]}
                    </h3>
                    <div className="space-y-3">
                      {recipes.map((recipe) => (
                        <RecipeCard 
                          key={recipe.id} 
                          recipe={recipe} 
                          onClick={() => handleViewRecipe(recipe)} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Quick Stats */}
              <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mt-6">
                <h4 className="font-semibold text-app-neutral mb-3">Estadísticas</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-app-primary">
                      {favoriteRecipes.length}
                    </div>
                    <p className="text-sm text-gray-600">Favoritas</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-app-accent">
                      {(favoriteRecipes.reduce((sum, recipe) => 
                        sum + (recipe.calificacionNinos || 0), 0) / favoriteRecipes.length).toFixed(1)}
                    </div>
                    <p className="text-sm text-gray-600">Promedio</p>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="text-center">
                <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-app-neutral mb-2">
                  ¡Aún no tienes recetas favoritas!
                </h3>
                <p className="text-gray-500 mb-6">
                  Marca tus recetas favoritas para que los chicos siempre encuentren sus comidas preferidas
                </p>
                <Button 
                  className="bg-app-primary text-white hover:bg-app-primary/90"
                  onClick={() => setShowAddRecipe(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primera Receta
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button 
          className="bg-app-primary text-white w-14 h-14 rounded-full shadow-lg hover:bg-app-primary/90 transform hover:scale-105 transition-all"
          onClick={() => setShowAddRecipe(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Modals */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        onEdit={handleEditRecipe}
        onAddToWeek={handleAddToWeek}
      />

      <AddRecipeModal
        isOpen={showAddRecipe}
        onClose={() => {
          setShowAddRecipe(false);
          setEditingRecipe(null);
        }}
        recipe={editingRecipe}
      />
    </div>
  );
}
