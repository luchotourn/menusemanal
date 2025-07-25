import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Edit3 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MealPlan, Recipe } from "@shared/schema";

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

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4">
              {/* Recipe Image */}
              {recipe.imagen && recipe.imagen.startsWith('http') && (
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
              )}

              {/* Meal Plan Context */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Planificado para <strong>{formatDate(mealPlan.fecha)}</strong> - <strong>{getMealTypeLabel(mealPlan.tipoComida)}</strong>
                </p>
              </div>

              {/* Description */}
              {recipe.descripcion && recipe.descripcion.trim().length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Descripción</h3>
                  <p className="text-gray-700">{recipe.descripcion}</p>
                </div>
              )}

              {/* Category */}
              {recipe.categoria && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Categoría</h3>
                  <span className="inline-block bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">
                    {recipe.categoria}
                  </span>
                </div>
              )}

              {/* Ingredients */}
              {recipe.ingredientes && recipe.ingredientes.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Ingredientes</h3>
                  <ul className="space-y-1">
                    {recipe.ingredientes.map((ingredient, index) => (
                      <li key={index} className="text-gray-700 flex items-start">
                        <span className="text-app-accent mr-2">•</span>
                        {ingredient}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructions */}
              {recipe.instrucciones && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Instrucciones</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{recipe.instrucciones}</p>
                </div>
              )}

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {recipe.tiempoPreparacion && (
                  <div>
                    <span className="font-medium text-gray-900">Tiempo:</span>
                    <p className="text-gray-700">{recipe.tiempoPreparacion} min</p>
                  </div>
                )}
                {recipe.porciones && (
                  <div>
                    <span className="font-medium text-gray-900">Porciones:</span>
                    <p className="text-gray-700">{recipe.porciones}</p>
                  </div>
                )}
              </div>

              {/* External Link */}
              {recipe.enlaceExterno && (
                <div>
                  <a
                    href={recipe.enlaceExterno}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-app-primary hover:underline text-sm"
                  >
                    Ver receta original →
                  </a>
                </div>
              )}
            </div>
          </ScrollArea>

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