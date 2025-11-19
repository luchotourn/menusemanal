import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";
import type { MealAchievement } from "@shared/schema";

interface AwardStarRequest {
  mealPlanId: number;
  starType: 'tried_it' | 'ate_veggie' | 'left_feedback';
}

interface AwardStarResponse {
  message: string;
  achievement: MealAchievement;
}

interface UserStatsResponse {
  weeklyStars: {
    tried: number;
    veggie: number;
    feedback: number;
  };
  totalStars: number;
  streakDays: number;
}

// Hook for awarding stars and managing achievements
export function useMealAchievements(mealPlanId?: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Award a star mutation
  const awardStarMutation = useMutation({
    mutationFn: async (data: AwardStarRequest): Promise<AwardStarResponse> => {
      return await jsonApiRequest<AwardStarResponse>(`/api/achievements`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: response.message,
        description: "¡Sigue así! 🎉",
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
      if (mealPlanId) {
        queryClient.invalidateQueries({ queryKey: ["achievements", "meal", mealPlanId] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al otorgar estrella",
        description: error.message || "No se pudo otorgar la estrella. Inténtalo de nuevo.",
        variant: "destructive",
      });
      console.error("Award star error:", error);
    },
  });

  // Get achievements for a specific meal
  const mealAchievementsQuery = useQuery<MealAchievement[]>({
    queryKey: ["achievements", "meal", mealPlanId],
    queryFn: async () => {
      if (!mealPlanId) return [];
      return await jsonApiRequest<MealAchievement[]>(`/api/achievements/meal/${mealPlanId}`);
    },
    enabled: !!mealPlanId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: false,
  });

  return {
    awardStar: awardStarMutation.mutate,
    isAwarding: awardStarMutation.isPending,
    mealAchievements: mealAchievementsQuery.data || [],
    isLoadingAchievements: mealAchievementsQuery.isLoading,
  };
}

// Hook for user-specific achievements and stats
export function useUserAchievements(userId?: number, startDate?: string, endDate?: string) {
  const { toast } = useToast();

  // Get achievements for a user
  const userAchievementsQuery = useQuery<MealAchievement[]>({
    queryKey: ["achievements", "user", userId, startDate, endDate],
    queryFn: async () => {
      if (!userId) return [];
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const queryString = params.toString();
      const url = `/api/achievements/user/${userId}${queryString ? `?${queryString}` : ''}`;
      return await jsonApiRequest<MealAchievement[]>(url);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Get user stats
  const userStatsQuery = useQuery<UserStatsResponse>({
    queryKey: ["achievements", "stats", userId, startDate],
    queryFn: async () => {
      if (!userId) {
        return {
          weeklyStars: { tried: 0, veggie: 0, feedback: 0 },
          totalStars: 0,
          streakDays: 0,
        };
      }
      const params = startDate ? `?startDate=${startDate}` : '';
      return await jsonApiRequest<UserStatsResponse>(`/api/achievements/stats/${userId}${params}`);
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });

  return {
    achievements: userAchievementsQuery.data || [],
    stats: userStatsQuery.data,
    isLoadingAchievements: userAchievementsQuery.isLoading,
    isLoadingStats: userStatsQuery.isLoading,
    refetchAchievements: userAchievementsQuery.refetch,
    refetchStats: userStatsQuery.refetch,
  };
}
