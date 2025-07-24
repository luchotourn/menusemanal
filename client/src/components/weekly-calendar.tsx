import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, X, Trash2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import type { MealPlan, Recipe } from "@shared/schema";

interface WeeklyCalendarProps {
  onAddMeal: (date: string, mealType: string) => void;
  onViewMeal: (mealPlan: MealPlan & { recipe?: Recipe }) => void;
}

export function WeeklyCalendar({ onAddMeal, onViewMeal }: WeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(new Date()));
  const [mealToDelete, setMealToDelete] = useState<MealPlan | null>(null);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mealPlans, isLoading } = useQuery({
    queryKey: ["/api/meal-plans", { startDate: formatDate(currentWeekStart) }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: formatDate(currentWeekStart) });
      const response = await fetch(`/api/meal-plans?${params}`);
      if (!response.ok) throw new Error("Error al cargar el plan de comidas");
      return response.json() as Promise<MealPlan[]>;
    },
  });

  const { data: recipes } = useQuery({
    queryKey: ["/api/recipes"],
    queryFn: async () => {
      const response = await fetch("/api/recipes");
      if (!response.ok) throw new Error("Error al cargar las recetas");
      return response.json() as Promise<Recipe[]>;
    },
  });

  const weekDates = getWeekDates(currentWeekStart);

  const previousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const currentWeek = getMonday(today);
    setCurrentWeekStart(currentWeek);
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const currentWeek = getMonday(today);
    return currentWeekStart.toDateString() === currentWeek.toDateString();
  };

  const getMealsForDate = (date: Date, mealType: string) => {
    const dateStr = formatDate(date);
    const mealsForDate = mealPlans?.filter(mp => mp.fecha === dateStr && mp.tipoComida === mealType) || [];
    if (recipes) {
      return mealsForDate.map(mealPlan => {
        const recipe = recipes.find(r => r.id === mealPlan.recetaId);
        return { ...mealPlan, recipe };
      });
    }
    return [];
  };

  const deleteMealMutation = useMutation({
    mutationFn: async (mealPlanId: number) => {
      const response = await apiRequest("DELETE", `/api/meal-plans/${mealPlanId}`, null);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      toast({ title: "Comida eliminada del plan" });
    },
    onError: () => {
      toast({ title: "Error al eliminar la comida", variant: "destructive" });
    },
  });

  const handleDeleteMeal = (mealPlan: MealPlan) => {
    deleteMealMutation.mutate(mealPlan.id);
    setMealToDelete(null);
  };

  const handleToggleMealExpansion = (mealId: number) => {
    setExpandedMeal(expandedMeal === mealId ? null : mealId);
  };

  const handleDeleteClick = (mealPlan: MealPlan, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent meal expansion when clicking delete
    setMealToDelete(mealPlan);
  };

  const confirmDelete = () => {
    if (mealToDelete) {
      handleDeleteMeal(mealToDelete);
    }
  };

  const cancelDelete = () => {
    setMealToDelete(null);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-xs ${i < rating ? "text-app-accent" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  // Component for expandable meal card
  const MealCard = ({ meal, isExpanded, onToggle, onDelete, onViewRecipe }: {
    meal: MealPlan & { recipe?: Recipe };
    isExpanded: boolean;
    onToggle: () => void;
    onDelete: (event: React.MouseEvent) => void;
    onViewRecipe: () => void;
  }) => {
    const recipe = meal.recipe;
    
    return (
      <div className="bg-orange-50 rounded-lg overflow-hidden transition-all duration-200">
        {/* Main meal row - always visible */}
        <div 
          className="flex items-center justify-between p-2 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {recipe?.nombre || "Receta no encontrada"}
              </p>
              {recipe?.calificacionNinos && recipe.calificacionNinos > 0 && (
                <div className="flex items-center mt-1">
                  <span className="text-xs text-gray-500 mr-1">Kids:</span>
                  {renderStars(recipe.calificacionNinos)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 text-red-500 hover:bg-red-100"
              onClick={onDelete}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
            <div className="p-1">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && recipe && (
          <div className="px-2 pb-2 border-t border-orange-100">
            <div className="bg-white rounded-lg p-3 mt-2">
              {recipe.descripcion && (
                <p className="text-sm text-gray-600 mb-2">{recipe.descripcion}</p>
              )}
              
              {recipe.categoria && (
                <div className="flex items-center mb-2">
                  <span className="text-xs font-medium text-gray-500 mr-2">Categoría:</span>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{recipe.categoria}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-xs text-gray-500">
                  {recipe.esFavorita && (
                    <span className="flex items-center">
                      <span className="text-red-500 mr-1">♥</span>
                      Favorita
                    </span>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewRecipe();
                  }}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Ver Receta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Component for meal section (lunch or dinner)
  const MealSection = ({ meals, mealType, date, label }: {
    meals: (MealPlan & { recipe?: Recipe })[];
    mealType: string;
    date: Date;
    label: string;
  }) => (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
          onClick={() => onAddMeal(formatDate(date), mealType)}
        >
          <Plus className="text-gray-400 w-3 h-3" />
        </Button>
      </div>
      {meals.length > 0 ? (
        <div className="space-y-1">
          {meals.map((meal, mealIndex) => (
            <MealCard
              key={`${meal.id}-${mealIndex}`}
              meal={meal}
              isExpanded={expandedMeal === meal.id}
              onToggle={() => handleToggleMealExpansion(meal.id)}
              onDelete={(e) => handleDeleteClick(meal, e)}
              onViewRecipe={() => onViewMeal(meal)}
            />
          ))}
        </div>
      ) : (
        <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center">
          <p className="text-xs text-gray-400">Sin planificar</p>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return <div className="text-center py-8">Cargando plan semanal...</div>;
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-app-neutral">
          {isCurrentWeek() ? "Esta Semana" : "Semana"}
        </h2>
        <div className="flex items-center space-x-2">
          {!isCurrentWeek() && (
            <Button
              variant="outline"
              size="sm"
              className="mr-2 text-xs px-2 py-1 h-8 text-app-primary border-app-primary hover:bg-app-primary hover:text-white"
              onClick={goToCurrentWeek}
            >
              <Calendar className="w-3 h-3 mr-1" />
              Hoy
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={previousWeek}
          >
            <ChevronLeft className="text-gray-600 w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-600 min-w-[100px] text-center">
            {formatWeekRange(currentWeekStart)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={nextWeek}
          >
            <ChevronRight className="text-gray-600 w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {weekDates.map((date, index) => {
          const lunchMeals = getMealsForDate(date, "almuerzo");
          const dinnerMeals = getMealsForDate(date, "cena");
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          if (isWeekend && index === 5) {
            // Combine weekend days
            const sundayLunchMeals = getMealsForDate(weekDates[6], "almuerzo");
            const sundayDinnerMeals = getMealsForDate(weekDates[6], "cena");
            
            return (
              <Card key="weekend" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">SÁB-DOM</span>
                    <span className="text-lg font-semibold text-app-neutral">
                      {date.getDate()}-{weekDates[6].getDate()}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {/* Saturday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-400">SÁBADO</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MealSection 
                        meals={lunchMeals} 
                        mealType="almuerzo" 
                        date={date} 
                        label="Almuerzo" 
                      />
                      <MealSection 
                        meals={dinnerMeals} 
                        mealType="cena" 
                        date={date} 
                        label="Cena" 
                      />
                    </div>
                  </div>
                  
                  {/* Sunday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-400">DOMINGO</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MealSection 
                        meals={sundayLunchMeals} 
                        mealType="almuerzo" 
                        date={weekDates[6]} 
                        label="Almuerzo" 
                      />
                      <MealSection 
                        meals={sundayDinnerMeals} 
                        mealType="cena" 
                        date={weekDates[6]} 
                        label="Cena" 
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          } else if (!isWeekend) {
            // Regular weekday
            return (
              <Card key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">
                      {getDayName(date).toUpperCase()}
                    </span>
                    <span className="text-lg font-semibold text-app-neutral">
                      {date.getDate()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <MealSection 
                    meals={lunchMeals} 
                    mealType="almuerzo" 
                    date={date} 
                    label="Almuerzo" 
                  />
                  <MealSection 
                    meals={dinnerMeals} 
                    mealType="cena" 
                    date={date} 
                    label="Cena" 
                  />
                </div>
              </Card>
            );
          }
          return null;
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!mealToDelete} onOpenChange={() => setMealToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar comida?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta comida del plan semanal?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}