import { Menu, Utensils, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export function Header({ title, showBack }: HeaderProps = {}) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    window.history.back();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <ArrowLeft className="text-app-neutral w-5 h-5" />
              </Button>
            )}
            <Utensils className="text-app-primary text-xl w-6 h-6" />
            <h1 className="text-lg font-semibold text-app-neutral">
              {title || "Menu Familiar"}
            </h1>
          </div>
          <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-gray-100">
            <Menu className="text-app-neutral w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
