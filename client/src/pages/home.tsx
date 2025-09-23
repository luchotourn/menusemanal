import { useState } from "react";
import { Header } from "@/components/header";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeDetailModal } from "@/components/recipe-detail-modal";
import { MealPlanDetailModal } from "@/components/meal-plan-detail-modal";
import { MealSelectionModal } from "@/components/meal-selection-modal";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe, MealPlan } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { Users, UserPlus } from "lucide-react";
import { useProfile } from "@/hooks/useAuth";

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { profile } = useProfile();

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<(MealPlan & { recipe?: Recipe }) | null>(null);
  const [showMealPlanModal, setShowMealPlanModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<string>("almuerzo");
  const [showMealSelection, setShowMealSelection] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);



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

  const handleViewMealPlan = (mealPlan: MealPlan & { recipe?: Recipe }) => {
    setSelectedMealPlan(mealPlan);
    setShowMealPlanModal(true);
  };

  const handleAddMeal = (date: string, mealType: string) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setShowMealSelection(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    // Close meal plan modal and open edit recipe modal directly
    setShowMealPlanModal(false);
    setEditingRecipe(recipe);
    setShowAddRecipe(true);
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

  // Show welcome message for commentators without families
  if (profile?.role === "commentator" && !profile?.familyId) {
    return (
      <div className="min-h-screen bg-app-background">
        <Header />

        <main className="max-w-lg mx-auto px-4 pb-20">
          <div className="mt-6">
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-purple-800 mb-2">
                    ¡Bienvenido! 🎉
                  </h2>
                  <p className="text-purple-700 mb-6">
                    Para empezar a calificar las comidas familiares, necesitas unirte a tu familia.
                  </p>
                  <p className="text-purple-600 mb-6">
                    Pide a tus papás el código de invitación familiar de 6 dígitos.
                  </p>
                  <Button
                    onClick={() => setLocation("/family-settings")}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    size="lg"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Unirse a Familia
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4 bg-white border-purple-100">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl mb-2">💡</div>
                  <h3 className="font-semibold text-purple-800 mb-2">¿Cómo funciona?</h3>
                  <ol className="text-left text-sm text-purple-600 space-y-2">
                    <li>1. Pide el código familiar a tus papás</li>
                    <li>2. Ingresa el código de 6 dígitos</li>
                    <li>3. ¡Empieza a calificar las comidas con estrellas!</li>
                    <li>4. Deja comentarios sobre lo que te gusta</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-background">
      <Header />

      <main className="max-w-lg mx-auto px-4 pb-20">
        <WeeklyCalendar onAddMeal={handleAddMeal} onViewMealPlan={handleViewMealPlan} />




      </main>



      {/* Modals */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        onEdit={handleEditRecipe}
        onAddToWeek={handleAddToWeek}
      />



      <MealPlanDetailModal
        isOpen={showMealPlanModal}
        onClose={() => setShowMealPlanModal(false)}
        mealPlan={selectedMealPlan}
        onEditRecipe={handleEditRecipe}
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
