import { Utensils, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export function Header({ title, showBack }: HeaderProps = {}) {
  const handleBack = () => {
    window.history.back();
  };

  return (
    <header className="bg-papel/95 backdrop-blur border-b border-tinta/10 sticky top-0 z-50">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center space-x-2">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-crema"
            >
              <ArrowLeft className="text-tinta w-5 h-5" />
            </Button>
          )}
          <Utensils className="text-brasa text-xl w-6 h-6" />
          <h1 className="text-lg font-bold text-tinta tracking-tight">
            {title || "Menu Semanal"}
          </h1>
        </div>
      </div>
    </header>
  );
}
