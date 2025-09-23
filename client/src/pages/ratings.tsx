import { useState } from "react";
import { Star, Search } from "lucide-react";
import { Header } from "@/components/header";
import { CommentatorOnly } from "@/components/role-based-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

interface RecipeWithRating extends Recipe {
  userRating?: number;
  userComment?: string;
  averageRating?: number;
}

export default function Ratings() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: ratedRecipes, isLoading } = useQuery<RecipeWithRating[]>({
    queryKey: ["/api/recipes/my-ratings", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      return await apiRequest<RecipeWithRating[]>(`/api/recipes/my-ratings?${params}`);
    }
  });

  const renderStars = (rating: number, size: "sm" | "md" = "sm") => {
    const sizeClass = size === "md" ? "w-5 h-5" : "w-4 h-4";
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const getStarMessage = (rating: number) => {
    switch (rating) {
      case 1: return "No me gustó nada 😞";
      case 2: return "No me gustó mucho 😕";
      case 3: return "Estuvo bien 😐";
      case 4: return "¡Me gustó! 😊";
      case 5: return "¡Me encantó! 🤩";
      default: return "";
    }
  };

  return (
    <CommentatorOnly fallback={
      <div className="min-h-screen bg-app-background flex items-center justify-center">
        <div className="text-center p-6">
          <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Página de Calificaciones</h2>
          <p className="text-gray-500">Esta página es solo para miembros comentadores.</p>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <Header />

        <main className="max-w-lg mx-auto px-4 pb-20">
          <div className="mt-6">
            <div className="flex items-center space-x-3 mb-6">
              <Star className="text-purple-600 w-7 h-7 fill-purple-600" />
              <h2 className="text-2xl font-bold text-purple-800">Mis Estrellas</h2>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-4 h-4" />
              <Input
                placeholder="Buscar recetas que calificaste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-purple-200 focus:border-purple-400 focus:ring-purple-400"
              />
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-purple-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-3 bg-purple-100 rounded w-full mb-2"></div>
                      <div className="h-3 bg-purple-100 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Recipe ratings list */}
            {!isLoading && ratedRecipes && (
              <div className="space-y-4">
                {ratedRecipes.length === 0 ? (
                  <Card className="border-purple-200">
                    <CardContent className="text-center py-8">
                      <Star className="w-12 h-12 text-purple-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-purple-700 mb-2">
                        ¡Aún no has calificado ninguna receta!
                      </h3>
                      <p className="text-purple-600 mb-4">
                        Ve a las recetas y danos tu opinión con estrellas
                      </p>
                      <Button
                        onClick={() => window.location.href = "/recipes"}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Ver Recetas
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  ratedRecipes.map((recipe) => (
                    <Card key={recipe.id} className="border-purple-200 hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg text-purple-800 mb-2">
                              {recipe.nombre}
                            </CardTitle>
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-purple-700">Tu calificación:</span>
                                {renderStars(recipe.userRating || 0, "md")}
                              </div>
                            </div>
                          </div>
                          {recipe.imagen && (
                            <img
                              src={recipe.imagen}
                              alt={recipe.nombre}
                              className="w-16 h-16 rounded-lg object-cover border-2 border-purple-200"
                            />
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0">
                        {recipe.userRating && (
                          <div className="bg-purple-50 rounded-lg p-3 mb-3">
                            <p className="text-purple-700 font-medium text-sm">
                              {getStarMessage(recipe.userRating)}
                            </p>
                            {recipe.userComment && (
                              <p className="text-purple-600 text-sm mt-1 italic">
                                "{recipe.userComment}"
                              </p>
                            )}
                          </div>
                        )}

                        {recipe.averageRating && recipe.averageRating > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Calificación familiar:</span>
                            <div className="flex items-center space-x-1">
                              {renderStars(Math.round(recipe.averageRating))}
                              <span className="text-gray-500 ml-1">
                                ({recipe.averageRating.toFixed(1)})
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-100">
                          <span className="text-xs text-purple-500 bg-purple-100 px-2 py-1 rounded-full">
                            {recipe.categoria}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = `/recipes`}
                            className="border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            Ver Receta
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </CommentatorOnly>
  );
}