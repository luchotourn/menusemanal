import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";

export interface MealCommentItem {
  id: number;
  comment: string;
  emoji: string | null;
  userName: string;
  createdAt: string;
}

export interface RecipeCommentItem extends MealCommentItem {
  fecha: string;
  tipoComida: string;
}

interface SubmitCommentPayload {
  comment: string;
  emoji?: string;
}

interface SubmitCommentResponse {
  message: string;
  comment: MealCommentItem;
}

export function useMealComments(mealPlanId: number | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery<MealCommentItem[]>({
    queryKey: ["meal-comments", mealPlanId],
    queryFn: async () => {
      if (!mealPlanId) return [];
      return await jsonApiRequest<MealCommentItem[]>(
        `/api/meal-plans/${mealPlanId}/comments`
      );
    },
    enabled: !!mealPlanId,
    staleTime: 60 * 1000,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (payload: SubmitCommentPayload): Promise<SubmitCommentResponse> => {
      return await jsonApiRequest<SubmitCommentResponse>(
        `/api/meal-plans/${mealPlanId}/comment`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: () => {
      toast({ title: "¡Comentario enviado! 💬" });
      queryClient.invalidateQueries({ queryKey: ["meal-comments", mealPlanId] });
      queryClient.invalidateQueries({ queryKey: ["achievements", "meal", mealPlanId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar comentario",
        description: error.message || "Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    comments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    submitComment: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
  };
}

export function useRecipeRating(recipeId: number | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ratingQuery = useQuery<{ rating: number }>({
    queryKey: ["recipe-rating", recipeId],
    queryFn: async () => {
      if (!recipeId) return { rating: 0 };
      return await jsonApiRequest<{ rating: number }>(
        `/api/recipes/${recipeId}/rating`
      );
    },
    enabled: !!recipeId,
    staleTime: 60 * 1000,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (!recipeId) throw new Error("No recipe selected");
      return await jsonApiRequest(
        `/api/recipes/${recipeId}/rating`,
        {
          method: "POST",
          body: JSON.stringify({ rating }),
        }
      );
    },
    onSuccess: (_data, rating) => {
      toast({ title: rating === 0 ? "Calificación eliminada" : "¡Calificación guardada! ⭐" });
      queryClient.invalidateQueries({ queryKey: ["recipe-rating", recipeId] });
      queryClient.invalidateQueries({ queryKey: ["recipe-ratings-all", recipeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar calificación",
        description: error.message || "Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Safely extract numeric rating (guard against object responses)
  const rawRating = ratingQuery.data?.rating;
  const currentRating = typeof rawRating === 'number' ? rawRating : 0;

  return {
    currentRating,
    isLoadingRating: ratingQuery.isLoading,
    submitRating: submitMutation.mutate,
    isSubmittingRating: submitMutation.isPending,
  };
}

export function useRecipeComments(recipeId: number | undefined) {
  const commentsQuery = useQuery<RecipeCommentItem[]>({
    queryKey: ["recipe-comments", recipeId],
    queryFn: async () => {
      if (!recipeId) return [];
      return await jsonApiRequest<RecipeCommentItem[]>(
        `/api/recipes/${recipeId}/comments`
      );
    },
    enabled: !!recipeId,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  return {
    comments: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
  };
}

export interface RecipeRatingItem {
  id: number;
  rating: number;
  userName: string;
  createdAt: string;
}

export function useRecipeRatings(recipeId: number | undefined) {
  const ratingsQuery = useQuery<RecipeRatingItem[]>({
    queryKey: ["recipe-ratings-all", recipeId],
    queryFn: async () => {
      if (!recipeId) return [];
      return await jsonApiRequest<RecipeRatingItem[]>(
        `/api/recipes/${recipeId}/ratings`
      );
    },
    enabled: !!recipeId,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  return {
    ratings: ratingsQuery.data || [],
    isLoading: ratingsQuery.isLoading,
  };
}
