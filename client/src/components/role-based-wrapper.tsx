import React from "react";
import { useProfile } from "@/hooks/useAuth";

interface RoleBasedWrapperProps {
  children: React.ReactNode;
  allowedRoles: ("creator" | "commentator")[];
  fallback?: React.ReactNode;
}

/**
 * Wrapper component that conditionally renders children based on user role
 */
export function RoleBasedWrapper({ children, allowedRoles, fallback = null }: RoleBasedWrapperProps) {
  const { profile, isLoading } = useProfile();

  // Show nothing while loading
  if (isLoading) {
    return null;
  }

  // Check if user has access
  const hasAccess = profile?.role && allowedRoles.includes(profile.role as "creator" | "commentator");

  if (!hasAccess) {
    return fallback;
  }

  return <>{children}</>;
}

interface RoleSpecificComponentProps {
  children: React.ReactNode;
  role: "creator" | "commentator";
  fallback?: React.ReactNode;
}

/**
 * Component that only renders for a specific role
 */
export function CreatorOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedWrapper allowedRoles={["creator"]} fallback={fallback}>
      {children}
    </RoleBasedWrapper>
  );
}

export function CommentatorOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedWrapper allowedRoles={["commentator"]} fallback={fallback}>
      {children}
    </RoleBasedWrapper>
  );
}

/**
 * Hook to get user role information
 */
export function useUserRole() {
  const { profile, isLoading } = useProfile();

  return {
    role: profile?.role as "creator" | "commentator" | undefined,
    isCreator: profile?.role === "creator",
    isCommentator: profile?.role === "commentator",
    isLoading
  };
}