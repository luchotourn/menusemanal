import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStatus } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Authentication guard that redirects unauthenticated users to login
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const { data: authStatus, isLoading, isError } = useAuthStatus();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-background flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-8 h-8 border-4 border-app-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-app-neutral mb-2">Cargando...</h2>
          <p className="text-gray-600">Verificando tu sesión</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (isError || !authStatus?.authenticated) {
    setLocation("/login");
    return null;
  }

  // User is authenticated, show the protected content
  return <>{children}</>;
}

/**
 * Inverse guard for login/register pages - redirects authenticated users to home
 */
export function GuestGuard({ children }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const { data: authStatus, isLoading } = useAuthStatus();

  // Redirect to home if already authenticated (using useEffect to avoid render-time navigation)
  useEffect(() => {
    if (authStatus?.authenticated) {
      setLocation("/");
    }
  }, [authStatus?.authenticated, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-background flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-8 h-8 border-4 border-app-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-app-neutral mb-2">Cargando...</h2>
          <p className="text-gray-600">Verificando tu sesión</p>
        </div>
      </div>
    );
  }

  // Show redirecting state if authenticated
  if (authStatus?.authenticated) {
    return (
      <div className="min-h-screen bg-app-background flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-8 h-8 border-4 border-app-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-app-neutral mb-2">Redirigiendo...</h2>
          <p className="text-gray-600">Accediendo a tu cuenta</p>
        </div>
      </div>
    );
  }

  // User is not authenticated, show login/register forms
  return <>{children}</>;
}