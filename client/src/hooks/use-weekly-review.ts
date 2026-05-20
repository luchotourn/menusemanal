import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";

export type ReviewStatus = "submitted" | "approved" | "changes_requested";
export type SignoffVerdict = "approved" | "changes_requested";

export interface WeeklyReviewSignoff {
  id: number;
  weeklyReviewId: number;
  userId: number;
  userName: string;
  verdict: SignoffVerdict;
  note: string | null;
  reviewedAt: string;
}

export interface WeeklyReview {
  id: number;
  familyId: number;
  weekStartDate: string;
  status: ReviewStatus;
  submittedBy: number;
  submittedAt: string;
  lastReviewedBy: number | null;
  lastReviewedAt: string | null;
  lastReviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  signoffs: WeeklyReviewSignoff[];
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

  const signoffMutation = useMutation({
    mutationFn: async ({ verdict, note }: { verdict: SignoffVerdict; note?: string }) => {
      if (!weekStartDate) throw new Error("No se seleccionó una semana");
      return await jsonApiRequest("/api/weekly-reviews/signoff", {
        method: "POST",
        body: JSON.stringify({ weekStartDate, verdict, note }),
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.verdict === "approved"
          ? "Aprobaste la semana ✅"
          : "Pediste cambios en la semana ✋",
      });
      queryClient.invalidateQueries({ queryKey: ["weekly-review", weekStartDate] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al registrar tu revisión",
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
    signoff: signoffMutation.mutate,
    isSigningOff: signoffMutation.isPending,
  };
}
