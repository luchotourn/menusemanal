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

  // Simplified MealCard Component - just tap to open modal
  const MealCard = ({ meal }: {
    meal: MealPlan & { recipe?: Recipe };
  }) => {
    const recipe = meal.recipe;
    
    return (
      <div 
        className="bg-orange-50 rounded-lg p-3 cursor-pointer hover:bg-orange-100 transition-colors min-h-[44px] flex items-center"
        onClick={() => onViewMealPlan(meal)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {recipe?.nombre || "Receta no encontrada"}
          </p>
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
                <div className="space-y-4">
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
    </div>
  );
}