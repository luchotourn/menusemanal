import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@shared/schema";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-sm ${i < rating ? "text-app-accent" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  return (
    <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center space-x-3">
        {recipe.imagen && recipe.imagen.startsWith('http') && (
          <img 
            src={recipe.imagen} 
            alt={recipe.nombre}
            className="w-12 h-12 rounded-lg object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-app-neutral truncate">{recipe.nombre}</h4>
          <p className="text-sm text-gray-600 truncate">{recipe.categoria}</p>
          <div className="flex items-center space-x-1 mt-1">
            {renderStars(recipe.calificacionNinos || 0)}
            <span className="text-xs text-gray-500 ml-1">
              {recipe.calificacionNinos ? `${recipe.calificacionNinos}.0` : '0.0'}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 rounded-full hover:bg-gray-100"
          onClick={onClick}
        >
          <ChevronRight className="text-gray-400 w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
