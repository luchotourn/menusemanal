import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";

export interface WeeklyReview {
  id: number;
  familyId: number;
  weekStartDate: string;
  status: string;
  submittedBy: number;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export function useWeeklyReview(weekStartDate: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reviewQuery = useQuery<WeeklyReview | null>({
    queryKey: ["weekly-review", weekStartDate],
    queryFn: async () => {
      if (!weekStartDate) return null;
      return await jsonApiRequest<WeeklyReview | null>(
        `/api/weekly-reviews?weekStartDate=${encodeURIComponent(weekStartDate)}`
      );
    },
    enabled: !!weekStartDate,
    staleTime: 30 * 1000,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async (): Promise<WeeklyReview> => {
      if (!weekStartDate) throw new Error("No se seleccionó una semana");
      return await jsonApiRequest<WeeklyReview>("/api/weekly-reviews", {
        method: "POST",
        body: JSON.stringify({ weekStartDate }),
      });
    },
    onSuccess: () => {
      toast({ title: "Semana enviada para revisión ✉️" });
      queryClient.invalidateQueries({ queryKey: ["weekly-review", weekStartDate] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar para revisión",
        description: error.message || "Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    review: reviewQuery.data ?? null,
    isLoading: reviewQuery.isLoading,
    submit: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
  };
}
