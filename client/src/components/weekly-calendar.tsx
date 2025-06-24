import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import type { MealPlan, Recipe } from "@shared/schema";

interface WeeklyCalendarProps {
  onAddMeal: (date: string, mealType: string) => void;
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

  const getMealForDate = (date: Date, mealType: string) => {
    const dateStr = formatDate(date);
    const mealPlan = mealPlans?.find(mp => mp.fecha === dateStr && mp.tipoComida === mealType);
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
        <h2 className="text-xl font-semibold text-app-neutral">
          {isCurrentWeek() ? "Esta Semana" : "Semana"}
        </h2>
        <div className="flex items-center space-x-2">
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
          {!isCurrentWeek() && (
            <Button
              variant="outline"
              size="sm"
              className="ml-2 text-xs px-2 py-1 h-8 text-app-primary border-app-primary hover:bg-app-primary hover:text-white"
              onClick={goToCurrentWeek}
            >
              <Calendar className="w-3 h-3 mr-1" />
              Hoy
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {weekDates.map((date, index) => {
          const lunchMeal = getMealForDate(date, "almuerzo");
          const dinnerMeal = getMealForDate(date, "cena");
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          if (isWeekend && index === 5) {
            // Combine weekend days
            const sundayLunch = getMealForDate(weekDates[6], "almuerzo");
            const sundayDinner = getMealForDate(weekDates[6], "cena");
            
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
                        {lunchMeal ? (
                          <div 
                            className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg cursor-pointer"
                            onClick={() => onViewMeal(lunchMeal)}
                          >
                            {lunchMeal.recipe?.imagen && (
                              <img 
                                src={lunchMeal.recipe.imagen} 
                                alt={lunchMeal.recipe.nombre}
                                className="w-6 h-6 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-app-neutral truncate">
                                {lunchMeal.recipe?.nombre || 'Planificado'}
                              </p>
                            </div>
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
                        {dinnerMeal ? (
                          <div 
                            className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg cursor-pointer"
                            onClick={() => onViewMeal(dinnerMeal)}
                          >
                            {dinnerMeal.recipe?.imagen && (
                              <img 
                                src={dinnerMeal.recipe.imagen} 
                                alt={dinnerMeal.recipe.nombre}
                                className="w-6 h-6 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-app-neutral truncate">
                                {dinnerMeal.recipe?.nombre || 'Planificado'}
                              </p>
                            </div>
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
                        {sundayLunch ? (
                          <div 
                            className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg cursor-pointer"
                            onClick={() => onViewMeal(sundayLunch)}
                          >
                            {sundayLunch.recipe?.imagen && (
                              <img 
                                src={sundayLunch.recipe.imagen} 
                                alt={sundayLunch.recipe.nombre}
                                className="w-6 h-6 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-app-neutral truncate">
                                {sundayLunch.recipe?.nombre || 'Planificado'}
                              </p>
                            </div>
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
                        {sundayDinner ? (
                          <div 
                            className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg cursor-pointer"
                            onClick={() => onViewMeal(sundayDinner)}
                          >
                            {sundayDinner.recipe?.imagen && (
                              <img 
                                src={sundayDinner.recipe.imagen} 
                                alt={sundayDinner.recipe.nombre}
                                className="w-6 h-6 rounded object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-app-neutral truncate">
                                {sundayDinner.recipe?.nombre || 'Planificado'}
                              </p>
                            </div>
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
                  {lunchMeal ? (
                    <div 
                      className="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg cursor-pointer"
                      onClick={() => onViewMeal(lunchMeal)}
                    >
                      {lunchMeal.recipe?.imagen && (
                        <img 
                          src={lunchMeal.recipe.imagen} 
                          alt={lunchMeal.recipe.nombre}
                          className="w-8 h-8 rounded-lg object-cover"
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
                      </div>
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
                  {dinnerMeal ? (
                    <div 
                      className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg cursor-pointer"
                      onClick={() => onViewMeal(dinnerMeal)}
                    >
                      {dinnerMeal.recipe?.imagen && (
                        <img 
                          src={dinnerMeal.recipe.imagen} 
                          alt={dinnerMeal.recipe.nombre}
                          className="w-8 h-8 rounded-lg object-cover"
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
                      </div>
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
    </section>
  );
}
