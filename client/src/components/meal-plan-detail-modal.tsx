import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Edit3 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MealPlan, Recipe } from "@shared/schema";
import { StarRatingButtons } from "@/components/star-rating-buttons";

interface MealPlanDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan: (MealPlan & { recipe?: Recipe }) | null;
  onEditRecipe: (recipe: Recipe) => void;
}

export function MealPlanDetailModal({ isOpen, onClose, mealPlan, onEditRecipe }: MealPlanDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMealMutation = useMutation({
    mutationFn: async (mealPlanId: number) => {
      const response = await apiRequest("DELETE", `/api/meal-plans/${mealPlanId}`, null);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      toast({ title: "Comida eliminada del plan semanal" });
      onClose();
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({ title: "Error al eliminar la comida", variant: "destructive" });
    },
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-lg ${i < rating ? "text-app-accent" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  };

  const getMealTypeLabel = (tipo: string) => {
    return tipo === 'almuerzo' ? 'Almuerzo' : 'Cena';
  };

  const handleDelete = () => {
    if (mealPlan) {
      deleteMealMutation.mutate(mealPlan.id);
    }
  };

  const handleEditRecipe = () => {
    if (mealPlan?.recipe) {
      onEditRecipe(mealPlan.recipe);
      onClose();
    }
  };

  if (!mealPlan?.recipe) return null;

  const recipe = mealPlan.recipe;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] flex flex-col" aria-describedby="meal-plan-description">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-left">
              {recipe.nombre}
            </DialogTitle>
          </DialogHeader>
          <div id="meal-plan-description" className="sr-only">
            Detalles del plan de comida para {formatDate(mealPlan?.fecha || '')} - {getMealTypeLabel(mealPlan?.tipoComida || '')}
          </div>

          <div className="flex-1 -mx-6 px-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            <div className="space-y-4 pb-4">
              {/* Meal Plan Context */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Planificado para <strong>{formatDate(mealPlan.fecha)}</strong> - <strong>{getMealTypeLabel(mealPlan.tipoComida)}</strong>
                </p>
              </div>

              {/* Recipe Image - only show if it's a valid HTTP URL */}
              {recipe.imagen && recipe.imagen.startsWith('http') ? (
                <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={recipe.imagen}
                    alt={recipe.nombre}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : null}

              {/* Favorite Star - only show if es_favorita is 1 */}
              {recipe.esFavorita === 1 ? (
                <div className="flex items-center">
                  <span className="text-yellow-500 text-xl">★</span>
                  <span className="ml-2 text-sm text-gray-600">Favorita</span>
                </div>
              ) : null}

              {/* Description - only show if not empty */}
              {recipe.descripcion && recipe.descripcion.trim() ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Descripción</h3>
                  <p className="text-gray-700">{recipe.descripcion}</p>
                </div>
              ) : null}

              {/* Kids Rating - only show if greater than 0 */}
              {recipe.calificacionNinos && recipe.calificacionNinos > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Calificación de los chicos</h3>
                  <div className="flex items-center">
                    {renderStars(recipe.calificacionNinos || 0)}
                    <span className="ml-2 text-sm text-gray-600">({recipe.calificacionNinos}/5)</span>
                  </div>
                </div>
              ) : null}

              {/* Category - only show if not empty */}
              {recipe.categoria && recipe.categoria.trim() ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Categoría</h3>
                  <span className="inline-block bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">
                    {recipe.categoria}
                  </span>
                </div>
              ) : null}

              {/* Ingredients - only show if array has content */}
              {recipe.ingredientes && recipe.ingredientes.length > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Ingredientes</h3>
                  <ul className="space-y-1">
                    {recipe.ingredientes.filter(ingredient => ingredient && ingredient.trim()).map((ingredient, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-app-accent mr-2">•</span>
                        {ingredient}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Instructions - only show if not empty */}
              {recipe.instrucciones && recipe.instrucciones.trim() ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Instrucciones</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{recipe.instrucciones}</p>
                </div>
              ) : null}

              {/* Time - only show if greater than 0 */}
              {recipe.tiempoPreparacion && recipe.tiempoPreparacion > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Tiempo</h3>
                  <p className="text-gray-700">{recipe.tiempoPreparacion} minutos</p>
                </div>
              ) : null}

              {/* Portions - only show if greater than 0 */}
              {recipe.porciones && recipe.porciones > 0 ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Porciones</h3>
                  <p className="text-gray-700">{recipe.porciones} porciones</p>
                </div>
              ) : null}

              {/* External Link - only show if not empty */}
              {recipe.enlaceExterno && recipe.enlaceExterno.trim() ? (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Enlace Externo</h3>
                  <a
                    href={recipe.enlaceExterno}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-app-primary hover:underline text-sm break-all"
                  >
                    Ver receta original →
                  </a>
                </div>
              ) : null}

              {/* Star Rating Section - Kids Gamification */}
              <div className="border-t pt-4 mt-4">
                <StarRatingButtons
                  mealPlanId={mealPlan.id}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 space-y-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleEditRecipe}
              className="w-full"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Editar Receta
            </Button>
            
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full"
              disabled={deleteMealMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar del {formatDate(mealPlan.fecha)} - {getMealTypeLabel(mealPlan.tipoComida)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar comida?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar "{recipe.nombre}" del plan para {formatDate(mealPlan.fecha)} - {getMealTypeLabel(mealPlan.tipoComida)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}