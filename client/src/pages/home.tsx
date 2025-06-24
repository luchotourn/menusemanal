import { useState } from "react";
import { Header } from "@/components/header";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeDetailModal } from "@/components/recipe-detail-modal";
import { MealSelectionModal } from "@/components/meal-selection-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe, MealPlan } from "@shared/schema";
import { Link } from "wouter";

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<string>("almuerzo");
  const [showMealSelection, setShowMealSelection] = useState(false);

  const { data: recipes, isLoading: recipesLoading } = useQuery({
    queryKey: ["/api/recipes"],
    queryFn: async () => {
      const response = await fetch("/api/recipes");
      if (!response.ok) throw new Error("Error al cargar las recetas");
      return response.json() as Promise<Recipe[]>;
    },
  });

  const { data: favoriteRecipes } = useQuery({
    queryKey: ["/api/recipes", { favorites: true }],
    queryFn: async () => {
      const response = await fetch("/api/recipes?favorites=true");
      if (!response.ok) throw new Error("Error al cargar las recetas favoritas");
      return response.json() as Promise<Recipe[]>;
    },
  });

  const addToWeekMutation = useMutation({
    mutationFn: async ({ recipeId, date, mealType }: { recipeId: number; date: string; mealType: string }) => {
      const response = await apiRequest("POST", "/api/meal-plans", {
        fecha: date,
        recetaId: recipeId,
        tipoComida: mealType
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

  const handleViewMeal = (mealPlan: MealPlan & { recipe?: Recipe }) => {
    if (mealPlan.recipe) {
      handleViewRecipe(mealPlan.recipe);
    }
  };

  const handleAddMeal = (date: string, mealType: string) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setShowMealSelection(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    // Redirect to recipes page for editing
    window.location.href = "/recipes";
  };

  const handleAddToWeek = (recipe: Recipe) => {
    if (selectedDate && selectedMealType) {
      addToWeekMutation.mutate({ recipeId: recipe.id, date: selectedDate, mealType: selectedMealType });
    } else {
      // If no specific date selected, let user choose
      toast({ 
        title: "Selecciona un día de la semana para agregar esta receta",
        description: "Toca el botón '+' en el día deseado" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-app-background">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 pb-20">
        <WeeklyCalendar onAddMeal={handleAddMeal} onViewMeal={handleViewMeal} />



        {/* Favorite Recipes */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-app-neutral">Favoritas de los Chicos</h3>
            <Link href="/favorites">
              <Button variant="link" className="text-sm font-medium text-app-primary p-0">
                Ver todas
              </Button>
            </Link>
          </div>
          
          {favoriteRecipes && favoriteRecipes.length > 0 ? (
            <div className="space-y-3">
              {favoriteRecipes.slice(0, 3).map((recipe) => (
                <RecipeCard 
                  key={recipe.id} 
                  recipe={recipe} 
                  onClick={() => handleViewRecipe(recipe)} 
                />
              ))}
            </div>
          ) : (
            <Card className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="text-center">
                <div className="text-4xl mb-3">⭐</div>
                <p className="text-gray-500 mb-4">¡Aún no tienes recetas favoritas!</p>
                <Link href="/recipes">
                  <Button className="bg-app-primary text-white hover:bg-app-primary/90">
                    Ver Recetas
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </section>

        {/* Recipe Repository Preview */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-app-neutral">Todas las Recetas</h3>
            <Link href="/recipes">
              <Button variant="link" className="text-sm font-medium text-app-primary p-0">
                Ver todas
              </Button>
            </Link>
          </div>
          
          <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            {recipes && recipes.length > 0 ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">🍽️</div>
                <p className="text-gray-600 mb-4">
                  Tienes {recipes.length} receta{recipes.length !== 1 ? 's' : ''} guardada{recipes.length !== 1 ? 's' : ''}
                </p>
                <Link href="/recipes">
                  <Button className="bg-app-primary text-white hover:bg-app-primary/90">
                    Explorar Recetas
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl text-gray-300 mb-3">🍽️</div>
                <p className="text-gray-500 mb-4">¡Comienza agregando tu primera receta!</p>
                <Link href="/recipes">
                  <Button className="bg-app-primary text-white hover:bg-app-primary/90">
                    Ir a Recetas
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </section>
      </main>



      {/* Modals */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        onEdit={handleEditRecipe}
        onAddToWeek={handleAddToWeek}
      />



      <MealSelectionModal
        isOpen={showMealSelection}
        onClose={() => {
          setShowMealSelection(false);
          setSelectedDate("");
          setSelectedMealType("almuerzo");
        }}
        selectedDate={selectedDate}
        mealType={selectedMealType}
      />
    </div>
  );
}
