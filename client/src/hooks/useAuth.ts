import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";
import type { LoginFormData, RegisterFormData, UpdateProfileData, ChangePasswordData, AvatarUploadData, AccountDeletionData } from "@shared/schema";

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
    onSuccess: (response) => {
      toast({
        title: "¡Bienvenido!",
        description: response.message,
      });
      // Invalidate auth queries to refetch user data
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setLocation("/");
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
    onSuccess: (response) => {
      toast({
        title: "¡Cuenta creada!",
        description: response.message,
      });
      // Invalidate auth queries to refetch user data
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setLocation("/");
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
    staleTime: 0, // Always fetch fresh data
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