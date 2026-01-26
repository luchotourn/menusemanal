import { Calendar, Book, Heart, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useUserRole } from "./role-based-wrapper";

export function RoleBasedBottomNavigation() {
  const [location] = useLocation();
  const { isCreator, isCommentator, isLoading } = useUserRole();

  // Show loading state
  if (isLoading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <div className="w-12 h-12 bg-gray-200 animate-pulse rounded"></div>
            <div className="w-12 h-12 bg-gray-200 animate-pulse rounded"></div>
            <div className="w-12 h-12 bg-gray-200 animate-pulse rounded"></div>
            <div className="w-12 h-12 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
      </nav>
    );
  }

  // Creator navigation (adults/parents)
  const creatorNavItems = [
    { path: "/", icon: Calendar, label: "Semana", id: "home" },
    { path: "/recipes", icon: Book, label: "Comidas", id: "recipes" },
    { path: "/favorites", icon: Heart, label: "Favoritos", id: "favorites" },
    { path: "/settings", icon: Settings, label: "Ajustes", id: "settings" },
  ];

  // Commentator navigation (children) - unified with creator navigation
  const commentatorNavItems = [
    { path: "/", icon: Calendar, label: "Semana", id: "home" },
    { path: "/recipes", icon: Book, label: "Comidas", id: "recipes" },
    { path: "/favorites", icon: Heart, label: "Favoritos", id: "favorites" },
    { path: "/settings", icon: Settings, label: "Ajustes", id: "settings" },
  ];

  const navItems = isCreator ? creatorNavItems : commentatorNavItems;

  return (
    <nav className={`fixed bottom-0 left-0 right-0 border-t z-50 ${
      isCommentator
        ? "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200"
        : "bg-white border-gray-100"
    }`}>
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ path, icon: Icon, label, id }) => {
            const isActive = location === path;
            return (
              <Link key={id} href={path}>
                <button
                  className={`flex flex-col items-center py-2 px-3 transition-colors rounded-lg ${
                    isActive
                      ? isCommentator
                        ? "text-purple-600 bg-purple-100"
                        : "text-app-primary"
                      : isCommentator
                        ? "text-blue-600 hover:text-purple-600 hover:bg-purple-50"
                        : "text-gray-400 hover:text-app-neutral"
                  }`}
                >
                  <Icon className={`mb-1 ${isCommentator ? "w-6 h-6" : "w-5 h-5"}`} />
                  <span className={`font-medium ${isCommentator ? "text-xs" : "text-xs"}`}>
                    {label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}