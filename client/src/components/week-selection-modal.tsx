import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { getWeekDates, getMonday, formatDate, getDayName } from "@/lib/utils";
import type { Recipe } from "@shared/schema";

interface WeekSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  onConfirm: (recipe: Recipe, date: string, mealType: string) => void;
}

export function WeekSelectionModal({ isOpen, onClose, recipe, onConfirm }: WeekSelectionModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<string>("almuerzo");

  if (!recipe) return null;

  // Get current week dates
  const currentWeekStart = getMonday(new Date());
  const weekDates = getWeekDates(currentWeekStart);

  const handleConfirm = () => {
    if (selectedDate && selectedMealType) {
      onConfirm(recipe, selectedDate, selectedMealType);
      onClose();
      setSelectedDate("");
      setSelectedMealType("almuerzo");
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedDate("");
    setSelectedMealType("almuerzo");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-app-neutral">
            Agregar "{recipe.nombre}" a la Semana
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-6">
          {/* Day Selection */}
          <div>
            <h4 className="font-medium text-app-neutral mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Selecciona el día
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {weekDates.map((date) => {
                const dateStr = formatDate(date);
                const isSelected = selectedDate === dateStr;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                
                return (
                  <Button
                    key={dateStr}
                    variant={isSelected ? "default" : "outline"}
                    className={`p-3 h-auto flex-col space-y-1 ${
                      isSelected 
                        ? "bg-app-primary text-white" 
                        : isWeekend 
                          ? "bg-gray-50 hover:bg-gray-100" 
                          : "hover:bg-app-primary hover:text-white"
                    }`}
                    onClick={() => setSelectedDate(dateStr)}
                  >
                    <span className="text-xs font-medium">
                      {getDayName(date).substring(0, 3).toUpperCase()}
                    </span>
                    <span className="text-sm font-bold">
                      {date.getDate()}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Meal Type Selection */}
          <div>
            <h4 className="font-medium text-app-neutral mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Selecciona la comida
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={selectedMealType === "almuerzo" ? "default" : "outline"}
                className={`p-4 h-auto flex-col space-y-2 ${
                  selectedMealType === "almuerzo" 
                    ? "bg-orange-500 text-white hover:bg-orange-600" 
                    : "hover:bg-orange-50 hover:text-orange-600"
                }`}
                onClick={() => setSelectedMealType("almuerzo")}
              >
                <span className="text-2xl">🍽️</span>
                <span className="text-sm font-medium">Almuerzo</span>
              </Button>
              <Button
                variant={selectedMealType === "cena" ? "default" : "outline"}
                className={`p-4 h-auto flex-col space-y-2 ${
                  selectedMealType === "cena" 
                    ? "bg-blue-500 text-white hover:bg-blue-600" 
                    : "hover:bg-blue-50 hover:text-blue-600"
                }`}
                onClick={() => setSelectedMealType("cena")}
              >
                <span className="text-2xl">🌙</span>
                <span className="text-sm font-medium">Cena</span>
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              className="flex-1 bg-app-primary text-white hover:bg-app-primary/90"
              onClick={handleConfirm}
              disabled={!selectedDate}
            >
              Agregar al Plan
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}