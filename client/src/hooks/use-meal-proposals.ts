import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";

export interface MealProposalItem {
  id: number;
  mealPlanId: number;
  familyId: number;
  proposedBy: number;
  proposedRecipeId: number;
  reason: string | null;
  status: "pending" | "accepted" | "rejected";
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  proposerName: string;
  proposedRecipeName: string;
  proposedRecipeImage: string | null;
  proposedRecipeCategoria: string;
}

interface CreateProposalPayload {
  proposedRecipeId: number;
  reason?: string;
}

interface ReviewResult {
  proposal: Omit<MealProposalItem, "proposerName" | "proposedRecipeName" | "proposedRecipeImage" | "proposedRecipeCategoria">;
  mealPlanUpdated: boolean;
  autoRejectedCount: number;
}

export function useMealProposals(mealPlanId: number | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const proposalsQuery = useQuery<MealProposalItem[]>({
    queryKey: ["meal-proposals", mealPlanId],
    queryFn: async () => {
      if (!mealPlanId) return [];
      return await jsonApiRequest<MealProposalItem[]>(
        `/api/meal-plans/${mealPlanId}/proposals`
      );
    },
    enabled: !!mealPlanId,
    staleTime: 30 * 1000,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateProposalPayload) => {
      if (!mealPlanId) throw new Error("No se seleccionó un plan");
      return await jsonApiRequest(
        `/api/meal-plans/${mealPlanId}/proposals`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: () => {
      toast({ title: "Propuesta enviada 💡" });
      queryClient.invalidateQueries({ queryKey: ["meal-proposals", mealPlanId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar la propuesta",
        description: error.message || "Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ proposalId, status }: { proposalId: number; status: "accepted" | "rejected" }) => {
      if (!mealPlanId) throw new Error("No se seleccionó un plan");
      return await jsonApiRequest<ReviewResult>(
        `/api/meal-plans/${mealPlanId}/proposals/${proposalId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );
    },
    onSuccess: (result, variables) => {
      toast({
        title: variables.status === "accepted" ? "Propuesta aceptada ✅" : "Propuesta rechazada",
      });
      queryClient.invalidateQueries({ queryKey: ["meal-proposals", mealPlanId] });
      // If accepted, the meal plan's recipe changed — refresh the calendar
      if (variables.status === "accepted") {
        queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al revisar la propuesta",
        description: error.message || "Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    proposals: proposalsQuery.data ?? [],
    isLoading: proposalsQuery.isLoading,
    createProposal: createMutation.mutate,
    isCreating: createMutation.isPending,
    reviewProposal: reviewMutation.mutate,
    isReviewing: reviewMutation.isPending,
  };
}
