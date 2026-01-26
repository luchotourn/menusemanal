import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleBasedBottomNavigation } from "@/components/role-based-navigation";
import { AuthGuard, GuestGuard } from "@/components/auth-guard";
import "@/styles/commentator-theme.css";

import Home from "@/pages/home";
import Recipes from "@/pages/recipes";
import Favorites from "@/pages/favorites";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import FamilySettings from "@/pages/family-settings";
import Family from "@/pages/family";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen">
      <Switch>
        {/* Authentication routes (no navigation) - only for guests */}
        <Route path="/login">
          <GuestGuard>
            <Login />
          </GuestGuard>
        </Route>
        <Route path="/register">
          <GuestGuard>
            <Register />
          </GuestGuard>
        </Route>

        {/* Main app routes (with navigation) - require authentication */}
        <Route path="/">
          <AuthGuard>
            <Home />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route path="/recipes">
          <AuthGuard>
            <Recipes />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route path="/favorites">
          <AuthGuard>
            <Favorites />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route path="/settings">
          <AuthGuard>
            <Settings />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route path="/profile">
          <AuthGuard>
            <Profile />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route path="/family-settings">
          <AuthGuard>
            <FamilySettings />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route path="/family">
          <AuthGuard>
            <Family />
            <ConditionalBottomNavigation />
          </AuthGuard>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function ConditionalBottomNavigation() {
  return <RoleBasedBottomNavigation />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
