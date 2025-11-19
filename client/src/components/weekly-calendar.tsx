import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, Star, Leaf, MessageCircle } from "lucide-react";
import { AddMealButton } from "@/components/add-meal-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatWeekRange, formatEnhancedWeekRange, getMonday, getDayName, formatDate, getWeekDates } from "@/lib/utils";
import type { MealPlan, Recipe, MealAchievement } from "@shared/schema";
import { useMealAchievements } from "@/hooks/use-meal-achievements";

interface WeeklyCalendarProps {
  onAddMeal: (date: string, mealType: string) => void;
  onViewMealPlan: (mealPlan: MealPlan & { recipe?: Recipe }) => void;
}

export function WeeklyCalendar({ onAddMeal, onViewMealPlan }: WeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(new Date()));
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys when no input/textarea is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'BUTTON') {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousWeek();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextWeek();
      } else if (event.key === 'Home' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        goToCurrentWeek();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWeekStart]);

  const previousWeek = () => {
    setIsTransitioning(true);
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
    setTimeout(() => setIsTransitioning(false), 200);
  };

  const nextWeek = () => {
    setIsTransitioning(true);
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
    setTimeout(() => setIsTransitioning(false), 200);
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
    const { mealAchievements } = useMealAchievements(meal.id);

    // Get current user's achievements for this meal (first one if multiple family members)
    const userAchievement = mealAchievements[0];

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
        className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 cursor-pointer hover:bg-gradient-to-r hover:from-orange-100 hover:to-orange-200 transition-all border border-orange-200 shadow-sm h-[88px]"
        onClick={() => onViewMealPlan(meal)}
      >
        <div className="flex flex-col justify-between h-full">
          {/* Recipe Name - Allow multiple lines */}
          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
            {recipe.nombre}
          </p>

          {/* Additional info section - show kid rating, favorite, OR achievements */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex items-center gap-1">
              {/* Kid Rating */}
              {(recipe.calificacionNinos ?? 0) > 0 ? (
                <div className="flex">
                  {renderStars(recipe.calificacionNinos ?? 0)}
                </div>
              ) : null}

              {/* Favorite indicator */}
              {Boolean(recipe.esFavorita) ? (
                <span className="text-xs text-orange-600 font-medium">⭐</span>
              ) : null}
            </div>

            {/* Achievement stars indicators */}
            {userAchievement && (
              <div className="flex items-center gap-1">
                {userAchievement.triedIt === 1 && (
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" title="Lo probé" />
                )}
                {userAchievement.ateVeggie === 1 && (
                  <Leaf className="w-3 h-3 text-green-600 fill-green-600" title="Comí vegetales" />
                )}
                {userAchievement.leftFeedback === 1 && (
                  <MessageCircle className="w-3 h-3 text-blue-600 fill-blue-600" title="Dejé opinión" />
                )}
              </div>
            )}
          </div>
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
      <div className="mb-1">
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      {meals.length > 0 ? (
        <div className="space-y-1">
          {meals.map((meal, mealIndex) => (
            <MealCard
              key={`${meal.id}-${mealIndex}`}
              meal={meal}
            />
          ))}

          {/* Multi-meal support - allow adding more meals to same slot */}
          <AddMealButton
            variant="append"
            onClick={() => onAddMeal(formatDate(date), mealType)}
            label="Agregar nuevo"
            className="mt-1 border-2 border-dashed border-gray-300"
          />
        </div>
      ) : (
        <AddMealButton
          variant="empty"
          onClick={() => onAddMeal(formatDate(date), mealType)}
          label="Agregar nuevo"
          showIcon={false}
          className="border-2 border-dashed border-gray-300"
        />
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
      {/* Responsive Header with week navigation */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 shadow-sm lg:p-6 md:p-4 p-3">
        <div className="flex items-center justify-between lg:mb-4 md:mb-3 mb-2">
          <div className="flex items-center lg:space-x-4 md:space-x-3 space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:p-3 md:p-2.5 p-2 rounded-xl hover:bg-slate-200/50 hover:scale-105 transition-all duration-200 shadow-sm border border-slate-200/50"
              onClick={previousWeek}
              disabled={isTransitioning}
            >
              <ChevronLeft className="text-slate-700 lg:w-6 lg:h-6 md:w-5 md:h-5 w-4 h-4" />
            </Button>
            
            <div className={`text-center transition-all duration-200 ${isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}`}>
              {(() => {
                const weekInfo = formatEnhancedWeekRange(currentWeekStart);
                return (
                  <div className="lg:space-y-1 md:space-y-1 space-y-0.5">
                    <div className="flex items-center lg:space-x-2 md:space-x-2 space-x-1">
                      <Calendar className="lg:w-4 lg:h-4 md:w-4 md:h-4 w-3 h-3 text-slate-600" />
                      <span className="lg:text-lg md:text-base text-sm font-bold text-slate-900 lg:min-w-[160px] md:min-w-[140px] min-w-[120px]">
                        {weekInfo.range}
                      </span>
                    </div>
                    <div className="flex items-center justify-center lg:space-x-3 md:space-x-2 space-x-1 lg:text-xs md:text-xs text-[10px] text-slate-600">
                      <span className="hidden md:inline">{weekInfo.monthContext}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="lg:p-3 md:p-2.5 p-2 rounded-xl hover:bg-slate-200/50 hover:scale-105 transition-all duration-200 shadow-sm border border-slate-200/50"
              onClick={nextWeek}
              disabled={isTransitioning}
            >
              <ChevronRight className="text-slate-700 lg:w-6 lg:h-6 md:w-5 md:h-5 w-4 h-4" />
            </Button>
          </div>
          
          {!isCurrentWeek() && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToCurrentWeek}
              className="bg-white/80 hover:bg-white border-slate-300 text-slate-700 hover:text-slate-800 font-medium lg:text-sm md:text-sm text-xs lg:px-3 md:px-2.5 px-2"
            >
              <span className="hidden sm:inline">Ir a hoy</span>
              <span className="sm:hidden">Hoy</span>
            </Button>
          )}
        </div>
        
        {/* Keyboard navigation hint - hidden on mobile */}
        <div className="text-center hidden md:block">
          <p className="text-xs text-slate-600/70 font-medium">
            💡 Usa ← → para navegar entre semanas, Cmd/Ctrl + Home para ir a hoy
          </p>
        </div>
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