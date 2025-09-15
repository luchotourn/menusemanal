import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNavigation } from "@/components/bottom-navigation";

import Home from "@/pages/home";
import Recipes from "@/pages/recipes";
import Favorites from "@/pages/favorites";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import FamilySettings from "@/pages/family-settings";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen">
      <Switch>
        {/* Authentication routes (no navigation) */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        
        {/* Main app routes (with navigation) */}
        <Route path="/" component={Home} />
        <Route path="/recipes" component={Recipes} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route path="/family-settings" component={FamilySettings} />
        <Route component={NotFound} />
      </Switch>
      
      {/* Conditional bottom navigation - only show on main app routes */}
      <ConditionalBottomNavigation />
    </div>
  );
}

function ConditionalBottomNavigation() {
  const [location] = useLocation();
  const authRoutes = ['/login', '/register'];
  const shouldShowNavigation = !authRoutes.includes(location);
  
  return shouldShowNavigation ? <BottomNavigation /> : null;
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
