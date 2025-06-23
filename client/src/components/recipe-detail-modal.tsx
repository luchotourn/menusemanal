import { X, ExternalLink, Edit, Share2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@shared/schema";

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (recipe: Recipe) => void;
  onAddToWeek: (recipe: Recipe) => void;
}

export function RecipeDetailModal({ 
  recipe, 
  isOpen, 
  onClose, 
  onEdit, 
  onAddToWeek 
}: RecipeDetailModalProps) {
  if (!recipe) return null;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`${i < rating ? "text-app-accent" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe.nombre,
          text: recipe.descripcion || '',
          url: recipe.enlaceExterno || window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      if (recipe.enlaceExterno) {
        window.open(recipe.enlaceExterno, '_blank');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white border-b border-gray-100 p-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-app-neutral">
            {recipe.nombre}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-100"
            onClick={onClose}
          >
            <X className="text-gray-600 w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <div className="p-4">
          {recipe.imagen && (
            <div className="mb-6">
              <img 
                src={recipe.imagen} 
                alt={recipe.nombre}
                className="w-full h-48 object-cover rounded-xl"
              />
            </div>
          )}

          <div className="space-y-4">
            {recipe.descripcion && (
              <div>
                <h4 className="font-medium text-app-neutral mb-2">Descripción</h4>
                <p className="text-sm text-gray-600">{recipe.descripcion}</p>
              </div>
            )}

            <div>
              <h4 className="font-medium text-app-neutral mb-2">Categoría</h4>
              <Badge className="bg-app-primary bg-opacity-10 text-app-primary">
                {recipe.categoria}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium text-app-neutral mb-2">Calificación de los Chicos</h4>
              <div className="flex items-center space-x-1">
                {renderStars(recipe.calificacionNinos || 0)}
                <span className="text-sm text-gray-600 ml-2">
                  {recipe.calificacionNinos === 5 ? '¡Les encanta!' : 
                   recipe.calificacionNinos === 4 ? 'Les gusta mucho' :
                   recipe.calificacionNinos === 3 ? 'Les gusta' :
                   recipe.calificacionNinos === 2 ? 'No les gusta mucho' :
                   recipe.calificacionNinos === 1 ? 'No les gusta' :
                   'Sin calificar'}
                </span>
              </div>
            </div>

            {recipe.ingredientes && recipe.ingredientes.length > 0 && (
              <div>
                <h4 className="font-medium text-app-neutral mb-2">Ingredientes</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {recipe.ingredientes.map((ingrediente, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-app-primary mr-2">•</span>
                      {ingrediente}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.instrucciones && (
              <div>
                <h4 className="font-medium text-app-neutral mb-2">Instrucciones</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{recipe.instrucciones}</p>
              </div>
            )}

            {(recipe.tiempoPreparacion || recipe.porciones) && (
              <div className="grid grid-cols-2 gap-4">
                {recipe.tiempoPreparacion && (
                  <div>
                    <h4 className="font-medium text-app-neutral mb-1">Tiempo</h4>
                    <p className="text-sm text-gray-600">{recipe.tiempoPreparacion} min</p>
                  </div>
                )}
                {recipe.porciones && (
                  <div>
                    <h4 className="font-medium text-app-neutral mb-1">Porciones</h4>
                    <p className="text-sm text-gray-600">{recipe.porciones}</p>
                  </div>
                )}
              </div>
            )}

            {recipe.enlaceExterno && (
              <div>
                <h4 className="font-medium text-app-neutral mb-2">Enlaces Externos</h4>
                <a 
                  href={recipe.enlaceExterno}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-app-primary text-sm hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Ver receta completa</span>
                </a>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <Button 
                className="flex-1 bg-app-primary text-white hover:bg-app-primary/90"
                onClick={() => onAddToWeek(recipe)}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Agregar a la Semana
              </Button>
              <Button
                variant="outline"
                className="px-4"
                onClick={() => onEdit(recipe)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="px-4"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
