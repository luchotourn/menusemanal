import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";
import type { LoginFormData, RegisterFormData, UpdateProfileData, ChangePasswordData, AvatarUploadData, AccountDeletionData, CreateFamilyData, JoinFamilyData } from "@shared/schema";

interface AuthResponse {
  message: string;
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    familyId?: number;
    familyName?: string;
    familyInviteCode?: string;
    avatar?: string;
    notificationPreferences?: {
      email: boolean;
      recipes: boolean;
      mealPlans: boolean;
    };
    createdAt: string;
    updatedAt: string;
  };
}

interface AuthStatus {
  authenticated: boolean;
  user?: AuthResponse["user"];
}

// Authentication hooks
export function useAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData): Promise<AuthResponse> => {
      return await jsonApiRequest<AuthResponse>(`/api/auth/login`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: async (response) => {
      // Invalidate auth queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      toast({
        title: "¡Bienvenido!",
        description: response.message,
      });
      
      // Small delay to ensure queries invalidate before navigation
      setTimeout(() => {
        setLocation("/");
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error de autenticación",
        description: error.message || "No se pudo conectar con el servidor. Inténtalo de nuevo.",
        variant: "destructive",
      });
      console.error("Login error:", error);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData): Promise<AuthResponse> => {
      return await jsonApiRequest<AuthResponse>(`/api/auth/register`, {
        method: "POST",
        body: JSON.stringify({
          name: data.fullName,
          email: data.email,
          password: data.password,
          role: data.role
        }),
      });
    },
    onSuccess: async (response) => {
      // Invalidate auth queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      toast({
        title: "¡Cuenta creada!",
        description: response.message,
      });
      
      // Small delay to ensure queries invalidate before navigation
      setTimeout(() => {
        setLocation("/");
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error de registro",
        description: error.message || "No se pudo crear la cuenta. Inténtalo de nuevo.",
        variant: "destructive",
      });
      console.error("Register error:", error);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      return await jsonApiRequest<{ message: string }>(`/api/auth/logout`, {
        method: "POST",
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Sesión cerrada",
        description: response.message,
      });
      // Clear all cached data
      queryClient.clear();
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Error al cerrar sesión",
        description: error.message || "Error al cerrar sesión",
        variant: "destructive",
      });
      console.error("Logout error:", error);
    },
  });

  return {
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
    isLoading: loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
  };
}

// Auth status query hook
export function useAuthStatus() {
  return useQuery<AuthStatus>({
    queryKey: ["auth", "status"],
    queryFn: async () => {
      return await jsonApiRequest<AuthStatus>(`/api/auth/status`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

// Profile management hooks
export function useProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const profileQuery = useQuery<AuthResponse>({
    queryKey: ["profile"],
    queryFn: async () => {
      return await jsonApiRequest<AuthResponse>(`/api/auth/profile`);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on failure
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData): Promise<AuthResponse> => {
      return await jsonApiRequest<AuthResponse>(`/api/auth/profile`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Perfil actualizado",
        description: response.message,
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar perfil",
        description: error.message || "No se pudo actualizar el perfil",
        variant: "destructive",
      });
      console.error("Profile update error:", error);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData): Promise<{ message: string }> => {
      return await jsonApiRequest<{ message: string }>(`/api/auth/change-password`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Contraseña cambiada",
        description: response.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al cambiar contraseña",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
      console.error("Password change error:", error);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (data: AvatarUploadData): Promise<{ message: string; avatar: string }> => {
      return await jsonApiRequest<{ message: string; avatar: string }>(`/api/auth/avatar`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Avatar actualizado",
        description: response.message,
      });
      // Invalidate profile queries to refetch updated avatar
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar avatar",
        description: error.message || "No se pudo actualizar el avatar",
        variant: "destructive",
      });
      console.error("Avatar upload error:", error);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (data: AccountDeletionData): Promise<{ message: string }> => {
      return await jsonApiRequest<{ message: string }>(`/api/auth/account`, {
        method: "DELETE",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Cuenta eliminada",
        description: response.message,
      });
      // Clear all cached data and redirect to login
      queryClient.clear();
      // This should be handled by the redirect after logout in the API
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar cuenta",
        description: error.message || "No se pudo eliminar la cuenta",
        variant: "destructive",
      });
      console.error("Account deletion error:", error);
    },
  });

  return {
    profile: profileQuery.data?.user,
    isLoading: profileQuery.isLoading,
    isError: profileQuery.isError,
    error: profileQuery.error,
    refetch: profileQuery.refetch,
    updateProfile: updateProfileMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    uploadAvatar: uploadAvatarMutation.mutate,
    deleteAccount: deleteAccountMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    isDeletingAccount: deleteAccountMutation.isPending,
  };
}

// Family management interfaces
interface FamilyResponse {
  message?: string;
  id: number;
  nombre: string;
  codigoInvitacion: string;
  createdBy: number;
  createdAt: string;
}

interface FamilyMember {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "member";
  createdAt: string;
}

interface FamilyJoinResponse {
  message: string;
  family: {
    id: number;
    nombre: string;
  };
}

// Family management hooks
export function useFamilies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user's families
  const familiesQuery = useQuery<FamilyResponse[]>({
    queryKey: ["families"],
    queryFn: async () => {
      try {
        // For now, we'll extract family info from the user profile
        // The profile includes familyId, familyName, and familyInviteCode
        const profile = await jsonApiRequest<AuthResponse>(`/api/auth/profile`);

        // If user has a family, return it as an array
        if (profile.user?.familyId) {
          return [{
            id: profile.user.familyId,
            nombre: profile.user.familyName || "",
            codigoInvitacion: profile.user.familyInviteCode || "",
            createdBy: profile.user.id, // Assume current user for now
            createdAt: profile.user.createdAt
          }];
        }
      } catch (error) {
        // If unauthorized or error, return empty array
        console.error("Error fetching families:", error);
      }

      return [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on failure
  });

  // Create family
  const createFamilyMutation = useMutation({
    mutationFn: async (data: CreateFamilyData): Promise<FamilyResponse> => {
      return await jsonApiRequest<FamilyResponse>(`/api/families`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "¡Familia creada!",
        description: `La familia "${response.nombre}" ha sido creada exitosamente.`,
      });
      // Force refresh of all relevant queries
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      // Also refetch immediately
      queryClient.refetchQueries({ queryKey: ["families"] });
      queryClient.refetchQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear familia",
        description: error.message || "No se pudo crear la familia. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Join family
  const joinFamilyMutation = useMutation({
    mutationFn: async (data: JoinFamilyData): Promise<FamilyJoinResponse> => {
      return await jsonApiRequest<FamilyJoinResponse>(`/api/families/join`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      toast({
        title: "¡Te has unido a la familia!",
        description: response.message,
      });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al unirse a la familia",
        description: error.message || "Código de invitación inválido o expirado.",
        variant: "destructive",
      });
    },
  });

  return {
    families: familiesQuery.data || [],
    isLoading: familiesQuery.isLoading,
    isError: familiesQuery.isError,
    error: familiesQuery.error,
    refetch: familiesQuery.refetch,
    createFamily: createFamilyMutation.mutate,
    joinFamily: joinFamilyMutation.mutate,
    isCreating: createFamilyMutation.isPending,
    isJoining: joinFamilyMutation.isPending,
  };
}

// Family details and member management
export function useFamily(familyId: number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get family details
  const familyQuery = useQuery<FamilyResponse>({
    queryKey: ["family", familyId],
    queryFn: async () => {
      return await jsonApiRequest<FamilyResponse>(`/api/families/${familyId}`);
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Get family members
  const membersQuery = useQuery<FamilyMember[]>({
    queryKey: ["family", familyId, "members"],
    queryFn: async () => {
      return await jsonApiRequest<FamilyMember[]>(`/api/families/${familyId}/members`);
    },
    enabled: !!familyId,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  // Remove member (admin only)
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number): Promise<{ message: string }> => {
      return await jsonApiRequest<{ message: string }>(`/api/families/${familyId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Miembro removido",
        description: response.message,
      });
      queryClient.invalidateQueries({ queryKey: ["family", familyId, "members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al remover miembro",
        description: error.message || "No se pudo remover el miembro.",
        variant: "destructive",
      });
    },
  });

  // Leave family
  const leaveFamilyMutation = useMutation({
    mutationFn: async (): Promise<{ message: string }> => {
      return await jsonApiRequest<{ message: string }>(`/api/families/${familyId}/leave`, {
        method: "POST",
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Has abandonado la familia",
        description: response.message,
      });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al abandonar familia",
        description: error.message || "No se pudo abandonar la familia.",
        variant: "destructive",
      });
    },
  });

  // Regenerate invitation code (admin only)
  const regenerateCodeMutation = useMutation({
    mutationFn: async (): Promise<{ message: string; codigoInvitacion: string }> => {
      return await jsonApiRequest<{ message: string; codigoInvitacion: string }>(`/api/families/${familyId}/regenerate-code`, {
        method: "POST",
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Código regenerado",
        description: response.message,
      });
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al regenerar código",
        description: error.message || "No se pudo regenerar el código.",
        variant: "destructive",
      });
    },
  });

  return {
    family: familyQuery.data,
    members: membersQuery.data || [],
    isLoadingFamily: familyQuery.isLoading,
    isLoadingMembers: membersQuery.isLoading,
    isError: familyQuery.isError || membersQuery.isError,
    error: familyQuery.error || membersQuery.error,
    refetchFamily: familyQuery.refetch,
    refetchMembers: membersQuery.refetch,
    removeMember: removeMemberMutation.mutate,
    leaveFamily: leaveFamilyMutation.mutate,
    regenerateCode: regenerateCodeMutation.mutate,
    isRemoving: removeMemberMutation.isPending,
    isLeaving: leaveFamilyMutation.isPending,
    isRegenerating: regenerateCodeMutation.isPending,
  };
}