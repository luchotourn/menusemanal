import { X, ExternalLink, Edit, Share2, Calendar, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal, useDragToDismiss } from "@/components/ui/responsive-modal";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@shared/schema";
import { useRecipeComments, useRecipeRatings } from "@/hooks/use-meal-comments";
import { reactions } from "@/components/commentator/emoji-reactions";

const emojiMap = Object.fromEntries(reactions.map(r => [r.value, r.emoji]));

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
  const { comments, isLoading: isLoadingComments } = useRecipeComments(
    isOpen && recipe ? recipe.id : undefined
  );
  const { ratings, isLoading: isLoadingRatings } = useRecipeRatings(
    isOpen && recipe ? recipe.id : undefined
  );
  if (!recipe) return null;

  const formatCommentDate = (fecha: string, tipoComida: string) => {
    const date = new Date(fecha + "T00:00:00");
    const day = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
    return `${day} · ${tipoComida === "almuerzo" ? "Almuerzo" : "Cena"}`;
  };

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
    <ResponsiveModal 
      isOpen={isOpen} 
      onClose={onClose}
      title={recipe.nombre}
      className="p-0"
    >
      <div>
        <div className="px-5 sm:px-6 py-4">
          {recipe.imagen && recipe.imagen.startsWith('http') && (
            <div className="mb-5 -mx-5 sm:-mx-6">
              <img
                src={recipe.imagen}
                alt={recipe.nombre}
                className="w-full h-52 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="space-y-5">
            {recipe.descripcion && (
              <div>
                <h4 className="font-semibold text-app-neutral mb-1.5 text-sm uppercase tracking-wide">Descripción</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{recipe.descripcion}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-orange-100 text-orange-800">
                {recipe.categoria}
              </Badge>
              {!!recipe.tiempoPreparacion && (
                <Badge variant="outline" className="text-gray-600">
                  {recipe.tiempoPreparacion} min
                </Badge>
              )}
              {!!recipe.porciones && (
                <Badge variant="outline" className="text-gray-600">
                  {recipe.porciones} porciones
                </Badge>
              )}
            </div>

            {/* Per-user family ratings */}
            {!isLoadingRatings && ratings.length > 0 && (
              <div>
                <h4 className="font-semibold text-app-neutral mb-2 text-sm uppercase tracking-wide">Calificaciones</h4>
                <div className="space-y-1.5">
                  {ratings.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                        {r.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-gray-700 min-w-[4rem] truncate">{r.userName}</span>
                      <div className="flex items-center space-x-0.5">
                        {renderStars(r.rating)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recipe.ingredientes && recipe.ingredientes.length > 0 && (
              <div>
                <h4 className="font-semibold text-app-neutral mb-2 text-sm uppercase tracking-wide">Ingredientes</h4>
                <ul className="text-sm text-gray-600 space-y-1.5">
                  {recipe.ingredientes.map((ingrediente, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-app-primary mr-2 mt-0.5">•</span>
                      <span className="leading-snug">{ingrediente}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.instrucciones && (
              <div>
                <h4 className="font-semibold text-app-neutral mb-2 text-sm uppercase tracking-wide">Instrucciones</h4>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{recipe.instrucciones}</p>
              </div>
            )}

            {recipe.enlaceExterno && (
              <a
                href={recipe.enlaceExterno}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-app-primary text-sm font-medium hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Ver receta completa
              </a>
            )}

            {/* Family comments about this recipe */}
            {!isLoadingComments && comments.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-app-neutral mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  Opiniones ({comments.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2 items-start">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                        {c.userName?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">{c.userName}</span>
                          {c.emoji && <span className="text-sm">{emojiMap[c.emoji] ?? c.emoji}</span>}
                          <span className="text-[10px] text-gray-400 ml-auto">{formatCommentDate(c.fecha, c.tipoComida)}</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-snug">{c.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-2 pb-2">
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
      </div>
    </ResponsiveModal>
  );
}
