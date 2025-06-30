import { useState } from "react";
import { Search, Filter, Plus } from "lucide-react";
import { Header } from "@/components/header";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeDetailModal } from "@/components/recipe-detail-modal";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { WeekSelectionModal } from "@/components/week-selection-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";

const categories = [
  { value: "all", label: "Todas" },
  { value: "favorites", label: "Favoritas" },
  { value: "Plato Principal", label: "Platos Principales" },
  { value: "Postre", label: "Postres" },
  { value: "Merienda", label: "Meriendas" },
  { value: "Desayuno", label: "Desayuno" },
  { value: "Entrada", label: "Entradas" },
  { value: "Sopa", label: "Sopas" },
  { value: "Ensalada", label: "Ensaladas" },
  { value: "Bebida", label: "Bebidas" }
];

export default function Recipes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showWeekSelection, setShowWeekSelection] = useState(false);
  const [recipeForWeek, setRecipeForWeek] = useState<Recipe | null>(null);

  const { data: recipes, isLoading } = useQuery({
    queryKey: ["/api/recipes", { category: selectedCategory, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory === "favorites") {
        params.append("favorites", "true");
      } else if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/recipes?${params}`);
      if (!response.ok) throw new Error("Error al cargar las recetas");
      return response.json() as Promise<Recipe[]>;
    },
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
      toast({ title: "¡Receta agregada al plan semanal!" });
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

  const filteredRecipes = recipes || [];

  return (
    <div className="min-h-screen bg-app-background">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 pb-20">
        <div className="mt-6">
          <h2 className="text-2xl font-bold text-app-neutral mb-6">Todas las Comidas</h2>
          
          {/* Search and Filter */}
          <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar comidas..."
                  className="pl-10 bg-gray-50 border-0 focus:bg-white"
                />
              </div>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category.value}
                  variant="ghost"
                  size="sm"
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedCategory === category.value
                      ? "bg-app-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  onClick={() => setSelectedCategory(category.value)}
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </Card>

          {/* Add Recipe Button */}
          <div className="mb-6">
            <Button 
              className="w-full bg-app-primary text-white hover:bg-app-primary/90 rounded-xl py-3"
              onClick={() => setShowAddRecipe(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Comida
            </Button>
          </div>

          {/* Recipes List */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando recetas...</p>
            </div>
          ) : filteredRecipes.length > 0 ? (
            <div className="space-y-3">
              {filteredRecipes.map((recipe) => (
                <RecipeCard 
                  key={recipe.id} 
                  recipe={recipe} 
                  onClick={() => handleViewRecipe(recipe)} 
                />
              ))}
            </div>
          ) : (
            <Card className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-app-neutral mb-2">
                  {searchQuery || selectedCategory !== "all" 
                    ? "No se encontraron recetas" 
                    : "¡Aún no tienes recetas!"
                  }
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || selectedCategory !== "all"
                    ? "Intenta con otros términos de búsqueda o filtros"
                    : "Comienza agregando tu primera receta deliciosa"
                  }
                </p>
                <Button 
                  className="bg-app-primary text-white hover:bg-app-primary/90"
                  onClick={() => setShowAddRecipe(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Receta
                </Button>
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
