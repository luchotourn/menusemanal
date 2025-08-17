import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import type { MealPlan, Recipe } from "@shared/schema";

interface WeeklyCalendarProps {
  onAddMeal: (date: string, mealType: string) => void;
  onViewMealPlan: (mealPlan: MealPlan & { recipe?: Recipe }) => void;
}

export function WeeklyCalendar({ onAddMeal, onViewMealPlan }: WeeklyCalendarProps) {
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
    const todayMonday = getMonday(today);
    return formatDate(todayMonday) === formatDate(currentWeekStart);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDate(date) === formatDate(today);
  };

  const getMealsForDate = (date: Date, mealType: string) => {
    const dateStr = formatDate(date);
    const dailyMeals = (mealPlans || []).filter(
      (plan) => plan.fecha === dateStr && plan.tipoComida === mealType
    );

    return dailyMeals.map((mealPlan) => {
      const recipe = recipes?.find((r) => r.id === mealPlan.recetaId);
      return { ...mealPlan, recipe };
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-xs ${i < rating ? "text-app-accent" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  // Enhanced MealCard Component with meal preview details
  const MealCard = ({ meal }: {
    meal: MealPlan & { recipe?: Recipe };
  }) => {
    const recipe = meal.recipe;
    
    if (!recipe) {
      return (
        <div className="bg-red-50 rounded-lg p-3 cursor-pointer hover:bg-red-100 transition-colors min-h-[44px] flex items-center">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-600 truncate">
              Receta no encontrada
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div 
        className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 cursor-pointer hover:bg-gradient-to-r hover:from-orange-100 hover:to-orange-200 transition-all border border-orange-200 shadow-sm min-h-[70px]"
        onClick={() => onViewMealPlan(meal)}
      >
        <div className="flex flex-col justify-between h-full">
          {/* Recipe Name - Allow multiple lines */}
          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
            {recipe.nombre}
          </p>
          
          {/* Additional info section - only show if there's actual content */}
          {((recipe.calificacionNinos ?? 0) > 0 || Boolean(recipe.esFavorita)) ? (
            <div className="flex items-center justify-between mt-2">
              {/* Kid Rating */}
              {(recipe.calificacionNinos ?? 0) > 0 ? (
                <div className="flex">
                  {renderStars(recipe.calificacionNinos ?? 0)}
                </div>
              ) : null}
              
              {/* Favorite indicator */}
              {Boolean(recipe.esFavorita) ? (
                <span className="text-xs text-orange-600 font-medium">⭐ Favorita</span>
              ) : null}
            </div>
          ) : null}
        </div>
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
            />
          ))}
        </div>
      ) : (
        <div 
          className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center cursor-pointer hover:border-app-accent hover:bg-orange-50/50 transition-all group"
          onClick={() => onAddMeal(formatDate(date), mealType)}
        >
          <div className="flex flex-col items-center space-y-1">
            <Plus className="w-4 h-4 text-gray-300 group-hover:text-app-accent transition-colors" />
            <p className="text-xs text-gray-400 group-hover:text-app-accent transition-colors">
              {mealType === 'almuerzo' ? 'Agregar almuerzo' : 'Agregar cena'}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Cargando plan semanal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between">
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
        </div>
        {!isCurrentWeek() && (
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            Hoy
          </Button>
        )}
      </div>

      {/* Weekly calendar grid */}
      <div className="grid grid-cols-1 gap-3">
        {weekDates.map((date, index) => {
          const lunchMeals = getMealsForDate(date, "almuerzo");
          const dinnerMeals = getMealsForDate(date, "cena");
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;

          if (isWeekend && index === 5) {
            // Combine weekend days
            const sundayLunchMeals = getMealsForDate(weekDates[6], "almuerzo");
            const sundayDinnerMeals = getMealsForDate(weekDates[6], "cena");
            const isSaturdayToday = isToday(date);
            const isSundayToday = isToday(weekDates[6]);
            const isWeekendToday = isSaturdayToday || isSundayToday;
            
            return (
              <Card key="weekend" className={`rounded-xl p-4 shadow-sm transition-all ${
                isWeekendToday 
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-app-accent shadow-md' 
                  : 'bg-white border border-gray-100'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">SÁB-DOM</span>
                    <span className="text-lg font-semibold text-app-neutral">
                      {date.getDate()}-{weekDates[6].getDate()}
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Saturday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${
                          isSaturdayToday ? 'text-app-accent' : 'text-gray-400'
                        }`}>SÁBADO</span>
                        {isSaturdayToday && (
                          <span className="text-xs bg-app-accent text-white px-2 py-1 rounded-full font-medium">
                            HOY
                          </span>
                        )}
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
                  </div>
                  
                  {/* Sunday */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium ${
                          isSundayToday ? 'text-app-accent' : 'text-gray-400'
                        }`}>DOMINGO</span>
                        {isSundayToday && (
                          <span className="text-xs bg-app-accent text-white px-2 py-1 rounded-full font-medium">
                            HOY
                          </span>
                        )}
                      </div>
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
            const isCurrentDay = isToday(date);
            return (
              <Card key={index} className={`rounded-xl p-4 shadow-sm transition-all ${
                isCurrentDay 
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-app-accent shadow-md' 
                  : 'bg-white border border-gray-100'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      isCurrentDay ? 'text-app-accent' : 'text-gray-500'
                    }`}>
                      {getDayName(date).toUpperCase()}
                    </span>
                    <span className={`text-lg font-semibold ${
                      isCurrentDay ? 'text-app-accent' : 'text-app-neutral'
                    }`}>
                      {date.getDate()}
                    </span>
                    {isCurrentDay && (
                      <span className="text-xs bg-app-accent text-white px-2 py-1 rounded-full font-medium">
                        HOY
                      </span>
                    )}
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
    </div>
  );
}