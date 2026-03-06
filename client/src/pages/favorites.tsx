import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { Header } from "@/components/header";
import { RecipeDetailModal } from "@/components/recipe-detail-modal";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { WeekSelectionModal } from "@/components/week-selection-modal";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, jsonApiRequest } from "@/lib/queryClient";
import { useUserRole } from "@/components/role-based-wrapper";
import type { Recipe } from "@shared/schema";

interface EngagedRecipe extends Recipe {
  commentCount: number;
  latestComment: string;
}

export default function Favorites() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isCommentator } = useUserRole();

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showWeekSelection, setShowWeekSelection] = useState(false);
  const [recipeForWeek, setRecipeForWeek] = useState<Recipe | null>(null);

  const { data: engagedRecipes, isLoading } = useQuery({
    queryKey: ["recipes-engaged"],
    queryFn: () => jsonApiRequest<EngagedRecipe[]>("/api/recipes/engaged"),
  });

  const addToWeekMutation = useMutation({
    mutationFn: async ({ recipeId, date, mealType }: { recipeId: number; date: string; mealType: string }) => {
      const response = await apiRequest("POST", "/api/meal-plans", {
        fecha: date,
        recetaId: recipeId,
        tipoComida: mealType
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      toast({ title: "Receta agregada al plan semanal!" });
      setShowRecipeModal(false);
    },
    onError: () => {
      toast({ title: "Error al agregar la receta al plan", variant: "destructive" });
    },
  });

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeModal(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowRecipeModal(false);
    setShowAddRecipe(true);
  };

  const handleAddToWeek = (recipe: Recipe) => {
    setRecipeForWeek(recipe);
    setShowWeekSelection(true);
  };

  const handleWeekSelectionConfirm = (recipe: Recipe, date: string, mealType: string) => {
    addToWeekMutation.mutate({ recipeId: recipe.id, date, mealType });
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return `hace ${days} dias`;
    if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
    return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  };

  const pageTitle = isCommentator ? "Mis Opiniones" : "Favoritas";
  const pageSubtitle = isCommentator
    ? "Comidas que comentaste"
    : "Comidas con mas opiniones de la familia";

  return (
    <div className="min-h-screen bg-app-background">
      <Header />

      <main className="max-w-lg mx-auto px-4 pb-20">
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-1">
            <Heart className="text-app-primary w-6 h-6 fill-current" />
            <h2 className="text-2xl font-bold text-app-neutral">{pageTitle}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-8">{pageSubtitle}</p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="animate-pulse flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : engagedRecipes && engagedRecipes.length > 0 ? (
            <div className="space-y-3">
              {engagedRecipes.map((recipe, index) => (
                <Card
                  key={recipe.id}
                  className="rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleViewRecipe(recipe)}
                >
                  <div className="flex items-center space-x-3">
                    {/* Rank badge */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      index === 0 ? "bg-yellow-100 text-yellow-700" :
                      index === 1 ? "bg-gray-100 text-gray-600" :
                      index === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-gray-50 text-gray-400"
                    }`}>
                      {index + 1}
                    </div>

                    {/* Recipe image */}
                    {recipe.imagen && recipe.imagen.startsWith('http') && (
                      <img
                        src={recipe.imagen}
                        alt={recipe.nombre}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-medium text-app-neutral truncate">{recipe.nombre}</h4>
                        {recipe.esFavorita === 1 && (
                          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{recipe.categoria}</p>
                    </div>

                    {/* Comment count + time */}
                    <div className="flex flex-col items-end flex-shrink-0">
                      <div className="flex items-center gap-1 text-blue-600">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">{recipe.commentCount}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {formatTimeAgo(recipe.latestComment)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Summary */}
              <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mt-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-app-primary">
                      {engagedRecipes.length}
                    </div>
                    <p className="text-xs text-gray-600">
                      {isCommentator ? "Comidas comentadas" : "Con opiniones"}
                    </p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {engagedRecipes.reduce((sum, r) => sum + r.commentCount, 0)}
                    </div>
                    <p className="text-xs text-gray-600">Comentarios totales</p>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-app-neutral mb-2">
                  {isCommentator ? "Todavia no comentaste ninguna comida" : "Sin opiniones aun"}
                </h3>
                <p className="text-gray-500">
                  {isCommentator
                    ? "Dejale un comentario a las comidas de la semana usando el boton de chat"
                    : "Cuando la familia comente las comidas, vas a verlas aca"}
                </p>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Modals */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        onEdit={handleEditRecipe}
        onAddToWeek={handleAddToWeek}
      />

      <AddRecipeModal
        isOpen={showAddRecipe}
        onClose={() => {
          setShowAddRecipe(false);
          setEditingRecipe(null);
        }}
        recipe={editingRecipe}
      />

      <WeekSelectionModal
        isOpen={showWeekSelection}
        onClose={() => {
          setShowWeekSelection(false);
          setRecipeForWeek(null);
        }}
        recipe={recipeForWeek}
        onConfirm={handleWeekSelectionConfirm}
      />
    </div>
  );
}
