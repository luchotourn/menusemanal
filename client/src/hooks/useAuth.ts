import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LoginFormData, RegisterFormData } from "@shared/schema";

interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData): Promise<AuthResponse> => {
      // For now, this is a placeholder implementation
      // In future issues, this will connect to the actual auth API
      console.log("Login attempt:", data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful login for development
      return {
        success: true,
        message: "Inicio de sesión exitoso",
        user: {
          id: "mock-user-id",
          email: data.email,
          fullName: "Usuario de Prueba",
          role: "creator"
        }
      };
    },
    onSuccess: (response) => {
      if (response.success) {
        toast({
          title: "¡Bienvenido!",
          description: response.message,
        });
        setLocation("/");
      } else {
        toast({
          title: "Error de autenticación",
          description: response.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
        variant: "destructive",
      });
      console.error("Login error:", error);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData): Promise<AuthResponse> => {
      // For now, this is a placeholder implementation
      // In future issues, this will connect to the actual auth API
      console.log("Register attempt:", data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful registration for development
      return {
        success: true,
        message: "Cuenta creada exitosamente",
        user: {
          id: "mock-user-id",
          email: data.email,
          fullName: data.fullName,
          role: data.role
        }
      };
    },
    onSuccess: (response) => {
      if (response.success) {
        toast({
          title: "¡Cuenta creada!",
          description: response.message,
        });
        setLocation("/");
      } else {
        toast({
          title: "Error de registro",
          description: response.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error de conexión",
        description: "No se pudo crear la cuenta. Inténtalo de nuevo.",
        variant: "destructive",
      });
      console.error("Register error:", error);
    },
  });

  return {
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLoading: loginMutation.isPending || registerMutation.isPending,
  };
}