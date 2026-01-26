import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Utensils, Calendar, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface FamilyComment {
  id: number;
  comment: string;
  emoji: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  mealPlan: {
    id: number;
    fecha: string;
    tipoComida: string;
  };
  recipe: {
    id: number;
    nombre: string;
  } | null;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "hace un momento";
  } else if (diffMinutes < 60) {
    return `hace ${diffMinutes} ${diffMinutes === 1 ? "minuto" : "minutos"}`;
  } else if (diffHours < 24) {
    return `hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  } else if (diffDays < 7) {
    return `hace ${diffDays} ${diffDays === 1 ? "día" : "días"}`;
  } else {
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short"
    });
  }
}

function formatMealDate(fecha: string): string {
  const date = new Date(fecha + "T12:00:00");
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short"
  });
}

function CommentsFeedSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i} className="border-gray-100">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyCommentsFeed() {
  return (
    <div className="text-center py-12">
      <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-700 mb-2">
        No hay comentarios todavía
      </h3>
      <p className="text-gray-500">
        ¡Comenta sobre las comidas de la familia!
      </p>
    </div>
  );
}

export function CommentsFeed() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: comments, isLoading, error } = useQuery<FamilyComment[]>({
    queryKey: ["/api/comments/family"],
    queryFn: async () => {
      const response = await fetch("/api/comments/family");
      if (!response.ok) throw new Error("Error al cargar los comentarios");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: number) => {
      // Find the comment to get the mealPlanId
      const comment = comments?.find(c => c.id === commentId);
      if (!comment) throw new Error("Comentario no encontrado");

      const response = await apiRequest("DELETE", `/api/meal-plans/${comment.mealPlan.id}/comments/${commentId}`);
      if (!response.ok) throw new Error("Error al eliminar el comentario");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comments/family"] });
      toast({ title: "Comentario eliminado" });
    },
    onError: () => {
      toast({ title: "Error al eliminar el comentario", variant: "destructive" });
    },
  });

  const handleCommentClick = (comment: FamilyComment) => {
    if (comment.recipe) {
      navigate(`/recipes?id=${comment.recipe.id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent, commentId: number) => {
    e.stopPropagation();
    if (confirm("¿Eliminar este comentario?")) {
      deleteMutation.mutate(commentId);
    }
  };

  if (isLoading) {
    return <CommentsFeedSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error al cargar los comentarios
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return <EmptyCommentsFeed />;
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <Card
          key={comment.id}
          className="border-gray-100 hover:border-gray-200 transition-colors cursor-pointer"
          onClick={() => handleCommentClick(comment)}
        >
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              {/* User Avatar */}
              <Avatar className="w-10 h-10 border-2 border-gray-200">
                <AvatarImage src={comment.user.avatar || undefined} />
                <AvatarFallback className="bg-app-primary/10 text-app-primary">
                  {comment.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                {/* Header: User name + timestamp + delete button */}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">
                    {comment.user.name}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                    {user?.id === comment.user.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        onClick={(e) => handleDelete(e, comment.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Meal context: Recipe name + date/type */}
                <div className="flex items-center text-sm text-gray-600 mb-2 flex-wrap gap-1">
                  <Utensils className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span className="truncate">
                    {comment.recipe?.nombre || "Comida"}
                  </span>
                  <span className="mx-1">•</span>
                  <Calendar className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span>
                    {formatMealDate(comment.mealPlan.fecha)} - {comment.mealPlan.tipoComida === "almuerzo" ? "Almuerzo" : "Cena"}
                  </span>
                </div>

                {/* Comment text with emoji */}
                <div className="flex items-start space-x-2">
                  {comment.emoji && (
                    <span className="text-xl flex-shrink-0">{comment.emoji}</span>
                  )}
                  <p className="text-gray-900">{comment.comment}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
