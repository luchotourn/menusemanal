import { useState } from "react";
import { Header } from "@/components/header";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeDetailModal } from "@/components/recipe-detail-modal";
import { MealPlanDetailModal } from "@/components/meal-plan-detail-modal";
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
  const [selectedMealPlan, setSelectedMealPlan] = useState<(MealPlan & { recipe?: Recipe }) | null>(null);
  const [showMealPlanModal, setShowMealPlanModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<string>("almuerzo");
  const [showMealSelection, setShowMealSelection] = useState(false);



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
    // Close meal plan modal and redirect directly to recipe editing
    setShowMealPlanModal(false);
    setSelectedRecipe(recipe);
    setShowRecipeModal(true);
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
    </div>
  );
}
