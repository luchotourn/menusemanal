import { useState } from "react";
import { MessageCircle, Heart, Users, Calendar } from "lucide-react";
import { Header } from "@/components/header";
import { CommentatorOnly } from "@/components/role-based-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MealPlan, Recipe } from "@shared/schema";

interface MealPlanWithDetails extends MealPlan {
  recipe: Recipe;
  comments: Array<{
    id: number;
    comment: string;
    emoji?: string;
    user: { name: string };
    createdAt: string;
  }>;
}

export default function Family() {
  const [selectedMeal, setSelectedMeal] = useState<MealPlanWithDetails | null>(null);
  const [newComment, setNewComment] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current week's meals
  const { data: weeklyMeals, isLoading } = useQuery<MealPlanWithDetails[]>({
    queryKey: ["/api/meal-plans/week", new Date().toISOString().split('T')[0]],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
      return await apiRequest<MealPlanWithDetails[]>(`/api/meal-plans/week?startDate=${startDate.toISOString().split('T')[0]}`);
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ mealPlanId, comment, emoji }: { mealPlanId: number; comment: string; emoji?: string }) => {
      return await apiRequest(`/api/meal-plans/${mealPlanId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, emoji })
      });
    },
    onSuccess: () => {
      toast({ title: "¡Comentario añadido!", description: "Tu opinión ha sido guardada" });
      setNewComment("");
      setSelectedEmoji("");
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans/week"] });
    },
    onError: () => {
      toast({
        title: "Error al añadir comentario",
        description: "Inténtalo de nuevo más tarde",
        variant: "destructive"
      });
    }
  });

  const emojis = ["😍", "😊", "😐", "😕", "🤔", "🤤", "👍", "👎"];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const handleAddComment = () => {
    if (!selectedMeal || !newComment.trim()) return;

    addCommentMutation.mutate({
      mealPlanId: selectedMeal.id,
      comment: newComment.trim(),
      emoji: selectedEmoji || undefined
    });
  };

  return (
    <CommentatorOnly fallback={
      <div className="min-h-screen bg-app-background flex items-center justify-center">
        <div className="text-center p-6">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Página Familiar</h2>
          <p className="text-gray-500">Esta página es solo para miembros comentadores.</p>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />

        <main className="max-w-lg mx-auto px-4 pb-20">
          <div className="mt-6">
            <div className="flex items-center space-x-3 mb-6">
              <MessageCircle className="text-blue-600 w-7 h-7" />
              <h2 className="text-2xl font-bold text-blue-800">Nuestra Familia</h2>
            </div>

            {/* Weekly overview */}
            <Card className="border-blue-200 mb-6">
              <CardHeader>
                <CardTitle className="text-blue-800 flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Comidas de Esta Semana</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-blue-100 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                ) : weeklyMeals && weeklyMeals.length > 0 ? (
                  <div className="space-y-3">
                    {weeklyMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => setSelectedMeal(meal)}
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-800">{meal.recipe.nombre}</h4>
                          <p className="text-sm text-blue-600">
                            {formatDate(meal.fecha)} • {meal.tipoComida}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {meal.comments && meal.comments.length > 0 && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                              {meal.comments.length} comentario{meal.comments.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <MessageCircle className="w-4 h-4 text-blue-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                    <p className="text-blue-600">No hay comidas planeadas para esta semana</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected meal details and comments */}
            {selectedMeal && (
              <Card className="border-purple-200">
                <CardHeader>
                  <CardTitle className="text-purple-800 flex items-center justify-between">
                    <span>{selectedMeal.recipe.nombre}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMeal(null)}
                      className="text-purple-600"
                    >
                      ✕
                    </Button>
                  </CardTitle>
                  <p className="text-purple-600">
                    {formatDate(selectedMeal.fecha)} • {selectedMeal.tipoComida}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Recipe details */}
                  {selectedMeal.recipe.descripcion && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-purple-700 text-sm">{selectedMeal.recipe.descripcion}</p>
                    </div>
                  )}

                  {/* Existing comments */}
                  {selectedMeal.comments && selectedMeal.comments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-purple-800">Comentarios de la familia:</h4>
                      {selectedMeal.comments.map((comment) => (
                        <div key={comment.id} className="bg-white rounded-lg p-3 border border-purple-100">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium text-purple-700 text-sm">{comment.user.name}</span>
                            <div className="flex items-center space-x-2">
                              {comment.emoji && <span className="text-lg">{comment.emoji}</span>}
                              <span className="text-xs text-purple-500">
                                {new Date(comment.createdAt).toLocaleDateString('es-ES')}
                              </span>
                            </div>
                          </div>
                          <p className="text-purple-800">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new comment */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-purple-800">¿Qué piensas de esta comida?</h4>

                    {/* Emoji selector */}
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-purple-600">Reacción:</span>
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setSelectedEmoji(selectedEmoji === emoji ? "" : emoji)}
                          className={`text-xl p-2 rounded-lg transition-colors ${
                            selectedEmoji === emoji
                              ? "bg-purple-200 scale-110"
                              : "hover:bg-purple-100"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Comment textarea */}
                    <Textarea
                      placeholder="Escribe tu comentario aquí..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                      rows={3}
                    />

                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 w-full"
                    >
                      {addCommentMutation.isPending ? "Añadiendo..." : "Añadir Comentario"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </CommentatorOnly>
  );
}