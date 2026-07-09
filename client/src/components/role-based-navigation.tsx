import { Calendar, Book, Heart, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { useUserRole } from "./role-based-wrapper";

export function RoleBasedBottomNavigation() {
  const [location] = useLocation();
  const { isCommentator, isLoading } = useUserRole();

  // Show loading state
  if (isLoading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-papel border-t border-tinta/10 z-50">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around py-2">
            <div className="w-12 h-12 bg-crema animate-pulse rounded"></div>
            <div className="w-12 h-12 bg-crema animate-pulse rounded"></div>
            <div className="w-12 h-12 bg-crema animate-pulse rounded"></div>
            <div className="w-12 h-12 bg-crema animate-pulse rounded"></div>
          </div>
        </div>
      </nav>
    );
  }

  const navItems = [
    { path: "/app", icon: Calendar, label: "Semana", id: "home" },
    { path: "/recipes", icon: Book, label: "Comidas", id: "recipes" },
    { path: "/favorites", icon: Heart, label: "Favoritas", id: "favorites" },
    { path: "/settings", icon: Settings, label: "Ajustes", id: "settings" },
  ];

  // One design system for both roles: same papel bar, warm ink, and a pill on
  // the active tab — brasa for creators, uva for commentators (kids keep
  // slightly larger icons for small hands).
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-papel border-t border-tinta/10 z-50">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ path, icon: Icon, label, id }) => {
            const isActive = location === path;
            return (
              <Link key={id} href={path}>
                <button
                  className={`flex flex-col items-center py-1.5 px-3 transition-colors ${
                    isActive
                      ? isCommentator
                        ? "text-uva"
                        : "text-brasa"
                      : "text-tinta/35 hover:text-tinta/70"
                  }`}
                >
                  <span
                    className={`mb-0.5 rounded-full px-3.5 py-1 transition-colors ${
                      isActive
                        ? isCommentator
                          ? "bg-purple-100"
                          : "bg-durazno-suave"
                        : "bg-transparent"
                    }`}
                  >
                    <Icon className={isCommentator ? "w-6 h-6" : "w-5 h-5"} />
                  </span>
                  <span className="font-semibold text-xs">
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
