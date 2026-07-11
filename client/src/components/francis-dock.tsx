import { useUserRole } from "@/components/role-based-wrapper";

interface FrancisDockProps {
  /** Opens the weekly plan sheet (instructions live there). */
  onOpenPlanner: () => void;
}

// The Francis dock, option A: one button, one promise. Francis only plans the
// week, so the dock says exactly that — no free-text field implying an open
// conversation. Instructions, planner profile and replace-week live in the
// sheet this button opens.
export function FrancisDock({ onOpenPlanner }: FrancisDockProps) {
  const { isCreator } = useUserRole();

  if (!isCreator) return null;

  return (
    <div className="fixed bottom-[64px] left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-lg mx-auto px-4 pb-2 pt-8 bg-gradient-to-t from-crema via-crema/90 to-transparent pointer-events-auto">
        <button
          type="button"
          onClick={onOpenPlanner}
          className="w-full flex items-center justify-center gap-2 bg-brasa hover:bg-brasa/90 active:scale-[0.99] transition-all text-white font-bold text-sm rounded-full py-3.5 shadow-lg shadow-brasa/40"
        >
          <span aria-hidden="true" className="text-base leading-none">👨‍🍳</span>
          Planear la semana con Francis
        </button>
      </div>
    </div>
  );
}
