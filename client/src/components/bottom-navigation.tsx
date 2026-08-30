import { Calendar, Book, Heart, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";

export function BottomNavigation() {
  const [location] = useLocation();

  const navItems = [
    { path: "/app", icon: Calendar, label: "Semana", id: "home" },
    { path: "/recipes", icon: Book, label: "Comidas", id: "recipes" },
    { path: "/favorites", icon: Heart, label: "Favoritas", id: "favorites" },
    { path: "/settings", icon: Settings, label: "Ajustes", id: "settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-papel border-t border-tinta/10 z-50">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ path, icon: Icon, label, id }) => {
            const isActive = location === path;
            return (
              <Link key={id} href={path}>
                <button
                  className={`flex flex-col items-center py-2 px-3 transition-colors ${
                    isActive ? "text-tomate" : "text-tinta/50 hover:text-tinta"
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
