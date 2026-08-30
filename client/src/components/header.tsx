import { ArrowLeft } from "lucide-react";
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
          <img
            src="/icon-192.png"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="w-7 h-7 rounded-[22%]"
          />
          <h1 className="font-display font-semibold uppercase tracking-[0.16em] text-[13px] text-cobalto">
            {title || "Menú Semanal"}
          </h1>
        </div>
      </div>
    </header>
  );
}
