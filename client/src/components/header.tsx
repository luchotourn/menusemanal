import { Menu, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Utensils className="text-app-primary text-xl w-6 h-6" />
            <h1 className="text-lg font-semibold text-app-neutral">Menu Familiar</h1>
          </div>
          <Button variant="ghost" size="sm" className="p-2 rounded-full hover:bg-gray-100">
            <Menu className="text-app-neutral w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
