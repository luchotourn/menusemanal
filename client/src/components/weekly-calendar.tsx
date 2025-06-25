import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
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

  // Keep this for backward compatibility where only one meal is expected
  const getMealForDate = (date: Date, mealType: string) => {
    const meals = getMealsForDate(date, mealType);
    return meals.length > 0 ? meals[0] : null;
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

  const handleLongPressStart = (mealPlan: MealPlan, event: React.TouchEvent | React.MouseEvent) => {
    // Prevent text selection and context menu
    event.preventDefault();
    
    const timer = setTimeout(() => {
      // Show delete confirmation after long press
      setMealToDelete(mealPlan);
      // Provide haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 400); // Reduced to 400ms for better responsiveness
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = (event?: React.TouchEvent | React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
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
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Almuerzo</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
                            onClick={() => onAddMeal(formatDate(date), "almuerzo")}
                          >
                            <Plus className="text-gray-400 w-3 h-3" />
                          </Button>
                        </div>
                        {lunchMeals.length > 0 ? (
                          <div className="space-y-1">
                            {lunchMeals.map((lunchMeal, mealIndex) => (
                              <div 
                                key={`${lunchMeal.id}-${mealIndex}`}
                                className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg cursor-pointer active:bg-orange-100 transition-colors select-none"
                                style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                                onClick={() => onViewMeal(lunchMeal)}
                                onTouchStart={(e) => handleLongPressStart(lunchMeal, e)}
                                onTouchEnd={(e) => handleLongPressEnd(e)}
                                onTouchCancel={(e) => handleLongPressEnd(e)}
                                onMouseDown={(e) => handleLongPressStart(lunchMeal, e)}
                                onMouseUp={(e) => handleLongPressEnd(e)}
                                onMouseLeave={(e) => handleLongPressEnd(e)}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                {lunchMeal.recipe?.imagen && lunchMeal.recipe.imagen.startsWith('http') && (
                                  <img 
                                    src={lunchMeal.recipe.imagen} 
                                    alt={lunchMeal.recipe.nombre}
                                    className="w-6 h-6 rounded object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-app-neutral truncate">
                                    {lunchMeal.recipe?.nombre || 'Planificado'}
                                  </p>
                                  {lunchMeals.length === 1 && (
                                    <p className="text-xs text-gray-400">Mantén presionado para eliminar</p>
                                  )}
                                </div>
                                {lunchMeals.length > 1 && (
                                  <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                                    {mealIndex + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                            {lunchMeals.length > 1 && (
                              <p className="text-xs text-gray-400 text-center mt-1">
                                Mantén presionado cualquier plato para eliminar
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-400">Sin planificar</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Cena</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
                            onClick={() => onAddMeal(formatDate(date), "cena")}
                          >
                            <Plus className="text-gray-400 w-3 h-3" />
                          </Button>
                        </div>
                        {dinnerMeals.length > 0 ? (
                          <div className="space-y-1">
                            {dinnerMeals.map((dinnerMeal, mealIndex) => (
                              <div 
                                key={`${dinnerMeal.id}-${mealIndex}`}
                                className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg cursor-pointer active:bg-blue-100 transition-colors select-none"
                                style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                                onClick={() => onViewMeal(dinnerMeal)}
                                onTouchStart={(e) => handleLongPressStart(dinnerMeal, e)}
                                onTouchEnd={(e) => handleLongPressEnd(e)}
                                onTouchCancel={(e) => handleLongPressEnd(e)}
                                onMouseDown={(e) => handleLongPressStart(dinnerMeal, e)}
                                onMouseUp={(e) => handleLongPressEnd(e)}
                                onMouseLeave={(e) => handleLongPressEnd(e)}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                {dinnerMeal.recipe?.imagen && dinnerMeal.recipe.imagen.startsWith('http') && (
                                  <img 
                                    src={dinnerMeal.recipe.imagen} 
                                    alt={dinnerMeal.recipe.nombre}
                                    className="w-6 h-6 rounded object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-app-neutral truncate">
                                    {dinnerMeal.recipe?.nombre || 'Planificado'}
                                  </p>
                                  {dinnerMeals.length === 1 && (
                                    <p className="text-xs text-gray-400">Mantén presionado para eliminar</p>
                                  )}
                                </div>
                                {dinnerMeals.length > 1 && (
                                  <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                                    {mealIndex + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                            {dinnerMeals.length > 1 && (
                              <p className="text-xs text-gray-400 text-center mt-1">
                                Mantén presionado cualquier plato para eliminar
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-400">Sin planificar</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sunday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-400">DOMINGO</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Almuerzo</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
                            onClick={() => onAddMeal(formatDate(weekDates[6]), "almuerzo")}
                          >
                            <Plus className="text-gray-400 w-3 h-3" />
                          </Button>
                        </div>
                        {sundayLunchMeals.length > 0 ? (
                          <div className="space-y-1">
                            {sundayLunchMeals.map((sundayLunch, mealIndex) => (
                              <div 
                                key={`${sundayLunch.id}-${mealIndex}`}
                                className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg cursor-pointer active:bg-orange-100 transition-colors select-none"
                                style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                                onClick={() => onViewMeal(sundayLunch)}
                                onTouchStart={(e) => handleLongPressStart(sundayLunch, e)}
                                onTouchEnd={(e) => handleLongPressEnd(e)}
                                onTouchCancel={(e) => handleLongPressEnd(e)}
                                onMouseDown={(e) => handleLongPressStart(sundayLunch, e)}
                                onMouseUp={(e) => handleLongPressEnd(e)}
                                onMouseLeave={(e) => handleLongPressEnd(e)}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                {sundayLunch.recipe?.imagen && sundayLunch.recipe.imagen.startsWith('http') && (
                                  <img 
                                    src={sundayLunch.recipe.imagen} 
                                    alt={sundayLunch.recipe.nombre}
                                    className="w-6 h-6 rounded object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-app-neutral truncate">
                                    {sundayLunch.recipe?.nombre || 'Planificado'}
                                  </p>
                                  {sundayLunchMeals.length === 1 && (
                                    <p className="text-xs text-gray-400">Mantén presionado para eliminar</p>
                                  )}
                                </div>
                                {sundayLunchMeals.length > 1 && (
                                  <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                                    {mealIndex + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-400">Sin planificar</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Cena</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
                            onClick={() => onAddMeal(formatDate(weekDates[6]), "cena")}
                          >
                            <Plus className="text-gray-400 w-3 h-3" />
                          </Button>
                        </div>
                        {sundayDinnerMeals.length > 0 ? (
                          <div className="space-y-1">
                            {sundayDinnerMeals.map((sundayDinner, mealIndex) => (
                              <div 
                                key={`${sundayDinner.id}-${mealIndex}`}
                                className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg cursor-pointer active:bg-blue-100 transition-colors select-none"
                                style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                                onClick={() => onViewMeal(sundayDinner)}
                                onTouchStart={(e) => handleLongPressStart(sundayDinner, e)}
                                onTouchEnd={(e) => handleLongPressEnd(e)}
                                onTouchCancel={(e) => handleLongPressEnd(e)}
                                onMouseDown={(e) => handleLongPressStart(sundayDinner, e)}
                                onMouseUp={(e) => handleLongPressEnd(e)}
                                onMouseLeave={(e) => handleLongPressEnd(e)}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                {sundayDinner.recipe?.imagen && sundayDinner.recipe.imagen.startsWith('http') && (
                                  <img 
                                    src={sundayDinner.recipe.imagen} 
                                    alt={sundayDinner.recipe.nombre}
                                    className="w-6 h-6 rounded object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-app-neutral truncate">
                                    {sundayDinner.recipe?.nombre || 'Planificado'}
                                  </p>
                                  {sundayDinnerMeals.length === 1 && (
                                    <p className="text-xs text-gray-400">Mantén presionado para eliminar</p>
                                  )}
                                </div>
                                {sundayDinnerMeals.length > 1 && (
                                  <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                                    {mealIndex + 1}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-400">Sin planificar</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          }

          if (isWeekend) return null; // Skip individual weekend days

          return (
            <Card key={date.toISOString()} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">{getDayName(date)}</span>
                  <span className="text-lg font-semibold text-app-neutral">{date.getDate()}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Lunch */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Almuerzo</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
                      onClick={() => onAddMeal(formatDate(date), "almuerzo")}
                    >
                      <Plus className="text-gray-400 w-3 h-3" />
                    </Button>
                  </div>
                  {lunchMeals.length > 0 ? (
                    <div className="space-y-2">
                      {lunchMeals.map((lunchMeal, mealIndex) => (
                        <div 
                          key={`${lunchMeal.id}-${mealIndex}`}
                          className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg cursor-pointer active:bg-orange-100 transition-colors select-none"
                          style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                          onClick={() => onViewMeal(lunchMeal)}
                          onTouchStart={(e) => handleLongPressStart(lunchMeal, e)}
                          onTouchEnd={(e) => handleLongPressEnd(e)}
                          onTouchCancel={(e) => handleLongPressEnd(e)}
                          onMouseDown={(e) => handleLongPressStart(lunchMeal, e)}
                          onMouseUp={(e) => handleLongPressEnd(e)}
                          onMouseLeave={(e) => handleLongPressEnd(e)}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          {lunchMeal.recipe?.imagen && lunchMeal.recipe.imagen.startsWith('http') && (
                            <img 
                              src={lunchMeal.recipe.imagen} 
                              alt={lunchMeal.recipe.nombre}
                              className="w-8 h-8 rounded-lg object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-app-neutral truncate">
                              {lunchMeal.recipe?.nombre || 'Planificado'}
                            </p>
                            {lunchMeal.recipe && (
                              <div className="flex items-center space-x-1">
                                {renderStars(lunchMeal.recipe.calificacionNinos || 0)}
                              </div>
                            )}
                            {lunchMeals.length === 1 && (
                              <p className="text-xs text-gray-400">Mantén presionado para eliminar</p>
                            )}
                          </div>
                          {lunchMeals.length > 1 && (
                            <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                              {mealIndex + 1}
                            </span>
                          )}
                        </div>
                      ))}
                      {lunchMeals.length > 1 && (
                        <p className="text-xs text-gray-400 text-center">
                          Mantén presionado cualquier plato para eliminar
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-400">Sin planificar</p>
                    </div>
                  )}
                </div>
                
                {/* Dinner */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Cena</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 rounded-full hover:bg-gray-100 h-6 w-6"
                      onClick={() => onAddMeal(formatDate(date), "cena")}
                    >
                      <Plus className="text-gray-400 w-3 h-3" />
                    </Button>
                  </div>
                  {dinnerMeals.length > 0 ? (
                    <div className="space-y-2">
                      {dinnerMeals.map((dinnerMeal, mealIndex) => (
                        <div 
                          key={`${dinnerMeal.id}-${mealIndex}`}
                          className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg cursor-pointer active:bg-blue-100 transition-colors select-none"
                          style={{ userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
                          onClick={() => onViewMeal(dinnerMeal)}
                          onTouchStart={(e) => handleLongPressStart(dinnerMeal, e)}
                          onTouchEnd={(e) => handleLongPressEnd(e)}
                          onTouchCancel={(e) => handleLongPressEnd(e)}
                          onMouseDown={(e) => handleLongPressStart(dinnerMeal, e)}
                          onMouseUp={(e) => handleLongPressEnd(e)}
                          onMouseLeave={(e) => handleLongPressEnd(e)}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          {dinnerMeal.recipe?.imagen && dinnerMeal.recipe.imagen.startsWith('http') && (
                            <img 
                              src={dinnerMeal.recipe.imagen} 
                              alt={dinnerMeal.recipe.nombre}
                              className="w-8 h-8 rounded-lg object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-app-neutral truncate">
                              {dinnerMeal.recipe?.nombre || 'Planificado'}
                            </p>
                            {dinnerMeal.recipe && (
                              <div className="flex items-center space-x-1">
                                {renderStars(dinnerMeal.recipe.calificacionNinos || 0)}
                              </div>
                            )}
                            {dinnerMeals.length === 1 && (
                              <p className="text-xs text-gray-400">Mantén presionado para eliminar</p>
                            )}
                          </div>
                          {dinnerMeals.length > 1 && (
                            <span className="text-xs text-gray-500 bg-white rounded-full px-2 py-0.5">
                              {mealIndex + 1}
                            </span>
                          )}
                        </div>
                      ))}
                      {dinnerMeals.length > 1 && (
                        <p className="text-xs text-gray-400 text-center">
                          Mantén presionado cualquier plato para eliminar
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-400">Sin planificar</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {mealToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full">
            <div className="flex items-center space-x-3 mb-4">
              <Trash2 className="text-red-500 w-6 h-6" />
              <h3 className="text-lg font-semibold text-app-neutral">Eliminar comida</h3>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar "{mealToDelete.recipe?.nombre || 'esta comida'}" 
              del plan? Esta acción no se puede deshacer.
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                disabled={deleteMealMutation.isPending}
              >
                {deleteMealMutation.isPending ? "Eliminando..." : "Eliminar"}
              </Button>
              <Button
                onClick={cancelDelete}
                variant="outline"
                className="flex-1"
                disabled={deleteMealMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
