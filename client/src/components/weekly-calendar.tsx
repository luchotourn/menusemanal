import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import type { MealPlan, Recipe } from "@shared/schema";

interface WeeklyCalendarProps {
  onAddMeal: (date: string) => void;
  onViewMeal: (mealPlan: MealPlan & { recipe?: Recipe }) => void;
}

export function WeeklyCalendar({ onAddMeal, onViewMeal }: WeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(new Date()));

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

  const getMealForDate = (date: Date) => {
    const dateStr = formatDate(date);
    const mealPlan = mealPlans?.find(mp => mp.fecha === dateStr);
    if (mealPlan && recipes) {
      const recipe = recipes.find(r => r.id === mealPlan.recetaId);
      return { ...mealPlan, recipe };
    }
    return null;
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
        <h2 className="text-xl font-semibold text-app-neutral">Esta Semana</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={previousWeek}
          >
            <ChevronLeft className="text-gray-600 w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-600">
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
          const meal = getMealForDate(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          if (isWeekend && index === 5) {
            // Combine weekend days
            const sundayMeal = getMealForDate(weekDates[6]);
            
            return (
              <Card key="weekend" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">SÁB-DOM</span>
                    <span className="text-lg font-semibold text-app-neutral">
                      {date.getDate()}-{weekDates[6].getDate()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1.5 rounded-full hover:bg-gray-100"
                    onClick={() => onAddMeal(formatDate(date))}
                  >
                    <Plus className="text-gray-600 w-4 h-4" />
                  </Button>
                </div>
                
                {meal || sundayMeal ? (
                  <div className="space-y-2">
                    {meal && (
                      <div 
                        className="flex items-center space-x-3 p-2 bg-orange-50 rounded-lg cursor-pointer"
                        onClick={() => onViewMeal(meal)}
                      >
                        {meal.recipe?.imagen && (
                          <img 
                            src={meal.recipe.imagen} 
                            alt={meal.recipe.nombre}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-app-neutral truncate">
                            {meal.recipe?.nombre || 'Comida planificada'}
                          </p>
                          {meal.recipe && (
                            <div className="flex items-center space-x-1">
                              {renderStars(meal.recipe.calificacionNinos || 0)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {sundayMeal && (
                      <div 
                        className="flex items-center space-x-3 p-2 bg-teal-50 rounded-lg cursor-pointer"
                        onClick={() => onViewMeal(sundayMeal)}
                      >
                        {sundayMeal.recipe?.imagen && (
                          <img 
                            src={sundayMeal.recipe.imagen} 
                            alt={sundayMeal.recipe.nombre}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-app-neutral truncate">
                            {sundayMeal.recipe?.nombre || 'Comida planificada'}
                          </p>
                          {sundayMeal.recipe && (
                            <div className="flex items-center space-x-1">
                              {renderStars(sundayMeal.recipe.calificacionNinos || 0)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Planificar fin de semana</p>
                  </div>
                )}
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1.5 rounded-full hover:bg-gray-100"
                  onClick={() => onAddMeal(formatDate(date))}
                >
                  <Plus className="text-gray-600 w-4 h-4" />
                </Button>
              </div>
              
              {meal ? (
                <div className="space-y-2">
                  <div 
                    className="flex items-center space-x-3 p-2 bg-orange-50 rounded-lg cursor-pointer"
                    onClick={() => onViewMeal(meal)}
                  >
                    {meal.recipe?.imagen && (
                      <img 
                        src={meal.recipe.imagen} 
                        alt={meal.recipe.nombre}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-app-neutral truncate">
                        {meal.recipe?.nombre || 'Comida planificada'}
                      </p>
                      {meal.recipe && (
                        <div className="flex items-center space-x-1">
                          {renderStars(meal.recipe.calificacionNinos || 0)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Agregar comida</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
