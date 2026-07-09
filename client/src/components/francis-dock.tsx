import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { useUserRole } from "@/components/role-based-wrapper";

const DOCK_CHIPS = [
  "Planeá la semana",
  "Más verduras esta semana",
  "Platos rápidos, poco tiempo",
  "Sin repetir pastas",
];

interface FrancisDockProps {
  /** Opens the generate flow with these instructions prefilled ("" = none). */
  onSubmit: (instructions: string) => void;
}

// The Francis command dock — the AI planner's front door on the week view.
// Sits above the bottom nav (creator only); chips submit straight away, free
// text submits on Enter/send. Both land in the generate flow prefilled.
export function FrancisDock({ onSubmit }: FrancisDockProps) {
  const { isCreator } = useUserRole();
  const [text, setText] = useState("");

  if (!isCreator) return null;

  const handleSubmit = (instructions: string) => {
    onSubmit(instructions.trim());
    setText("");
  };

  return (
    <div className="fixed bottom-[64px] left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-lg mx-auto px-4 pb-2 pt-8 bg-gradient-to-t from-crema via-crema/90 to-transparent pointer-events-auto">
        <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-none">
          {DOCK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSubmit(chip)}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-papel border border-tinta/10 text-tinta/70 hover:border-durazno hover:text-tinta active:bg-durazno-suave transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(text);
          }}
          className="flex items-center gap-2.5 bg-tinta text-crema rounded-[18px] rounded-br-md pl-4 pr-2 py-2 shadow-lg shadow-tinta/25"
        >
          <Sparkles className="w-4 h-4 text-durazno shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="Pedile a Francis…"
            aria-label="Pedile a Francis, el planificador, qué querés esta semana"
            className="flex-1 min-w-0 bg-transparent text-sm text-crema placeholder:text-crema/60 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Abrir el planificador con estas instrucciones"
            className="shrink-0 w-8 h-8 rounded-full bg-brasa hover:bg-brasa/90 active:scale-95 transition-all flex items-center justify-center"
          >
            <ArrowUp className="w-4 h-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
