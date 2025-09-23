import { useState } from "react";
import { Star, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useUserRole } from "./role-based-wrapper";

interface RecipeRatingProps {
  recipeId: number;
  recipeName: string;
  currentRating?: number;
  currentComment?: string;
  averageRating?: number;
  totalRatings?: number;
}

export function RecipeRating({
  recipeId,
  recipeName,
  currentRating = 0,
  currentComment = "",
  averageRating = 0,
  totalRatings = 0
}: RecipeRatingProps) {
  const [selectedRating, setSelectedRating] = useState(currentRating);
  const [comment, setComment] = useState(currentComment);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isCommentator } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ratingMutation = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment?: string }) => {
      return await apiRequest(`/api/recipes/${recipeId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment })
      });
    },
    onSuccess: () => {
      toast({
        title: "¡Calificación guardada!",
        description: `Le diste ${selectedRating} estrella${selectedRating !== 1 ? 's' : ''} a ${recipeName}`
      });
      setIsExpanded(false);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/my-ratings"] });
    },
    onError: () => {
      toast({
        title: "Error al guardar calificación",
        description: "Inténtalo de nuevo más tarde",
        variant: "destructive"
      });
    }
  });

  const renderStars = (rating: number, interactive = false, size: "sm" | "md" | "lg" = "md") => {
    const sizeClass = size === "lg" ? "w-8 h-8" : size === "md" ? "w-6 h-6" : "w-4 h-4";

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => interactive && setSelectedRating(star)}
            disabled={!interactive}
            className={`${sizeClass} transition-all ${
              interactive ? "hover:scale-110 cursor-pointer" : "cursor-default"
            } ${
              star <= rating
                ? isCommentator
                  ? "text-purple-400 fill-purple-400"
                  : "text-yellow-400 fill-yellow-400"
                : isCommentator
                  ? "text-purple-200"
                  : "text-gray-300"
            }`}
          >
            <Star className="w-full h-full" />
          </button>
        ))}
      </div>
    );
  };

  const getRatingMessage = (rating: number) => {
    const messages = {
      1: "No me gustó nada 😞",
      2: "No me gustó mucho 😕",
      3: "Estuvo bien 😐",
      4: "¡Me gustó! 😊",
      5: "¡Me encantó! 🤩"
    };
    return messages[rating as keyof typeof messages] || "";
  };

  const handleSubmit = () => {
    if (selectedRating === 0) {
      toast({
        title: "Selecciona una calificación",
        description: "Por favor elige al menos una estrella",
        variant: "destructive"
      });
      return;
    }

    ratingMutation.mutate({
      rating: selectedRating,
      comment: comment.trim() || undefined
    });
  };

  return (
    <Card className={`${isCommentator ? "border-purple-200" : "border-gray-200"}`}>
      <CardContent className="p-4">
        {/* Average rating display */}
        {averageRating > 0 && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className={`text-sm font-medium ${isCommentator ? "text-purple-700" : "text-gray-700"}`}>
                Calificación familiar:
              </span>
              {renderStars(Math.round(averageRating), false, "sm")}
              <span className={`text-sm ${isCommentator ? "text-purple-600" : "text-gray-600"}`}>
                ({averageRating.toFixed(1)})
              </span>
            </div>
            {totalRatings > 0 && (
              <span className={`text-xs ${isCommentator ? "text-purple-500" : "text-gray-500"}`}>
                {totalRatings} calificación{totalRatings !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        )}

        {/* Commentator rating interface */}
        {isCommentator && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-700">
                {currentRating > 0 ? "Tu calificación:" : "¿Qué te pareció?"}
              </span>
              {!isExpanded && currentRating > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  className="text-purple-600 hover:text-purple-700"
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}
            </div>

            {!isExpanded ? (
              <div
                className="cursor-pointer"
                onClick={() => setIsExpanded(true)}
              >
                {renderStars(currentRating || selectedRating, false, "lg")}
                {currentRating > 0 && (
                  <p className="text-purple-600 text-sm mt-2 font-medium">
                    {getRatingMessage(currentRating)}
                  </p>
                )}
                {currentComment && (
                  <p className="text-purple-700 text-sm mt-1 italic bg-purple-50 p-2 rounded">
                    "{currentComment}"
                  </p>
                )}
                {currentRating === 0 && (
                  <p className="text-purple-500 text-sm mt-2">
                    Toca para calificar esta receta
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  {renderStars(selectedRating, true, "lg")}
                </div>

                {selectedRating > 0 && (
                  <div className="text-center">
                    <p className="text-purple-700 font-medium">
                      {getRatingMessage(selectedRating)}
                    </p>
                  </div>
                )}

                <Textarea
                  placeholder="Cuéntanos qué te gustó o no te gustó... (opcional)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                  rows={3}
                />

                <div className="flex space-x-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={selectedRating === 0 || ratingMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 flex-1"
                  >
                    {ratingMutation.isPending ? "Guardando..." : "Guardar Calificación"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsExpanded(false);
                      setSelectedRating(currentRating);
                      setComment(currentComment);
                    }}
                    className="border-purple-300 text-purple-600"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Creator view (just display) */}
        {!isCommentator && averageRating === 0 && (
          <div className="text-center text-gray-500 text-sm py-2">
            Aún no hay calificaciones familiares
          </div>
        )}
      </CardContent>
    </Card>
  );
}