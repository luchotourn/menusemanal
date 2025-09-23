import { ChevronRight, Star, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserRole } from "./role-based-wrapper";
import type { Recipe } from "@shared/schema";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  userRating?: number;
  averageRating?: number;
}

export function RecipeCard({ recipe, onClick, userRating, averageRating }: RecipeCardProps) {
  const { isCommentator } = useUserRole();

  const renderStars = (rating: number, filled: boolean = true) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating
            ? filled
              ? isCommentator
                ? "text-purple-400 fill-purple-400"
                : "text-yellow-400 fill-yellow-400"
              : isCommentator
                ? "text-purple-400"
                : "text-yellow-400"
            : isCommentator
              ? "text-purple-200"
              : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <Card className={`rounded-xl p-4 shadow-sm border transition-all hover:shadow-md ${
      isCommentator
        ? "bg-gradient-to-br from-white to-purple-50 border-purple-100 hover:border-purple-200"
        : "bg-white border-gray-100 hover:border-gray-200"
    }`}>
      <div className="flex items-center space-x-3">
        {recipe.imagen && recipe.imagen.startsWith('http') && (
          <img
            src={recipe.imagen}
            alt={recipe.nombre}
            className={`w-12 h-12 rounded-lg object-cover border-2 ${
              isCommentator ? "border-purple-200" : "border-gray-200"
            }`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className={`font-medium truncate ${
              isCommentator ? "text-purple-800" : "text-app-neutral"
            }`}>
              {recipe.nombre}
            </h4>
            {recipe.esFavorita === 1 && (
              <Heart className={`w-4 h-4 ${
                isCommentator ? "text-purple-500 fill-purple-500" : "text-red-500 fill-red-500"
              }`} />
            )}
          </div>

          <p className={`text-sm truncate ${
            isCommentator ? "text-purple-600" : "text-gray-600"
          }`}>
            {recipe.categoria}
          </p>

          <div className="flex items-center justify-between mt-2">
            {/* Original kids rating */}
            <div className="flex items-center space-x-1">
              <span className={`text-xs ${
                isCommentator ? "text-purple-500" : "text-gray-500"
              }`}>
                Niños:
              </span>
              <div className="flex items-center space-x-1">
                {renderStars(recipe.calificacionNinos || 0)}
              </div>
            </div>

            {/* User rating for commentators */}
            {isCommentator && userRating && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-purple-600 font-medium">Tu:</span>
                <div className="flex items-center space-x-1">
                  {renderStars(userRating)}
                </div>
              </div>
            )}

            {/* Average family rating */}
            {averageRating && averageRating > 0 && (
              <div className="flex items-center space-x-1">
                <span className={`text-xs ${
                  isCommentator ? "text-purple-600" : "text-gray-600"
                }`}>
                  Familia: {averageRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`p-2 rounded-full transition-colors ${
            isCommentator
              ? "hover:bg-purple-100 text-purple-600"
              : "hover:bg-gray-100 text-gray-400"
          }`}
          onClick={onClick}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
