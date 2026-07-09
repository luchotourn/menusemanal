import { useEffect, useState } from "react";
import { Check, ChefHat, ChevronDown, ChevronUp, ChevronsUpDown, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Recipe } from "@shared/schema";
import { computeEmptySlots, slotKey } from "@shared/weekly-plan";
import {
  useWeeklyPlanGenerator,
  groupDraftItemsByDay,
  groupRecipesByCategory,
  formatDayHeading,
  swapDraftItem,
  removeDraftItem,
  accumulateAvoidIds,
  isMainAcompanamiento,
  type EnrichedDraftItem,
} from "@/hooks/use-weekly-plan-generator";

interface GenerateWeekModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStartDate: string;
  /** Instructions prefilled from the Francis dock ("" = start empty). */
  initialInstructions?: string;
}

type Step = "intent" | "generating" | "review";

const INSTRUCTION_CHIPS = [
  "Platos rápidos, tenemos poco tiempo",
  "Más verduras esta semana",
  "Sin repetir pastas",
  "Priorizá lo que más les gusta a los chicos",
];

export function GenerateWeekModal({ open, onOpenChange, weekStartDate, initialInstructions }: GenerateWeekModalProps) {
  const [step, setStep] = useState<Step>("intent");
  const [instructions, setInstructions] = useState("");
  const [replaceWeek, setReplaceWeek] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [promptDirty, setPromptDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  // Per-slot "Otra sugerencia" memory: every id already shown for a slot goes
  // into its avoid list so repeated taps keep bringing NEW dishes.
  const [rejectedBySlot, setRejectedBySlot] = useState<Record<string, number[]>>({});
  const [resuggestingSlot, setResuggestingSlot] = useState<string | null>(null);
  const [openSwapSlot, setOpenSwapSlot] = useState<string | null>(null);

  const {
    draft,
    isDraftLoading,
    plannerPrompt,
    generate,
    isGenerating,
    updateItems,
    isUpdatingItems,
    resuggest,
    isResuggesting,
    apply,
    isApplying,
    discard,
    isDiscarding,
    savePrompt,
    isSavingPrompt,
  } = useWeeklyPlanGenerator(open ? weekStartDate : undefined);

  // Existing meals of the week — same key + queryFn convention as the weekly
  // calendar so this reads straight from its cache.
  const { data: weekMealPlans } = useQuery({
    queryKey: ["/api/meal-plans", { startDate: weekStartDate }],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: weekStartDate });
      const response = await fetch(`/api/meal-plans?${params}`);
      if (!response.ok) throw new Error("Error al cargar el plan de comidas");
      return response.json() as Promise<Array<{ fecha: string; tipoComida: string }>>;
    },
    enabled: open && !!weekStartDate,
  });

  // Family recipe library for the per-slot swap Select (review step only).
  const { data: recipes } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
    enabled: open && step === "review",
  });

  // Reset one-shot state whenever the modal opens. A generation may still be
  // in flight from a previous open (the component stays mounted while closed),
  // so land on the progress screen instead of an intent form with a dead
  // button; the pending mutation's callbacks then move to review/intent.
  useEffect(() => {
    if (open) {
      setStep(isGenerating ? "generating" : "intent");
      setInstructions(initialInstructions ?? "");
      setReplaceWeek(false);
      setProfileOpen(false);
      setPromptDirty(false);
      setShowDiscardConfirm(false);
      setShowReplaceConfirm(false);
      setRejectedBySlot({});
      setResuggestingSlot(null);
      setOpenSwapSlot(null);
    }
  }, [open]);

  // Prefill the planner profile textarea until the user starts editing it.
  useEffect(() => {
    if (open && !promptDirty) {
      setPromptDraft(plannerPrompt ?? "");
    }
  }, [open, plannerPrompt, promptDirty]);

  // A pending draft for this week jumps straight into review.
  useEffect(() => {
    if (open && draft && step === "intent") {
      setStep("review");
    }
  }, [open, draft, step]);

  // Track visual viewport height for mobile keyboard handling.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [open]);

  if (!open) return null;

  const occupiedCount = weekMealPlans?.length ?? 0;
  const emptySlotCount = weekMealPlans
    ? computeEmptySlots(weekStartDate, weekMealPlans).length
    : null;
  const weekIsFull = emptySlotCount === 0;
  const occupiedKeys = new Set(
    (weekMealPlans ?? []).map((plan) => slotKey(plan.fecha, plan.tipoComida))
  );

  const handleGenerate = () => {
    if (isGenerating) return;
    setStep("generating");
    const trimmed = instructions.trim();
    generate(
      { instructions: trimmed || undefined, replaceWeek },
      {
        onSuccess: () => setStep("review"),
        onError: () => setStep("intent"),
      }
    );
  };

  const handleSwap = (item: EnrichedDraftItem, recetaId: number) => {
    if (!draft || isUpdatingItems || isResuggesting) return;
    if (recetaId === item.recetaId) return;
    updateItems({
      draftId: draft.id,
      items: swapDraftItem(draft.items, item.fecha, item.tipoComida, recetaId),
    });
  };

  const handleResuggest = (item: EnrichedDraftItem) => {
    if (!draft || isUpdatingItems || isResuggesting) return;
    const key = slotKey(item.fecha, item.tipoComida);
    // The current pick joins the slot's avoid list so the AI brings something new.
    const avoidRecipeIds = accumulateAvoidIds(rejectedBySlot[key], item.recetaId);
    setRejectedBySlot((previous) => ({ ...previous, [key]: avoidRecipeIds }));
    setResuggestingSlot(key);
    resuggest(
      { draftId: draft.id, fecha: item.fecha, tipoComida: item.tipoComida, avoidRecipeIds },
      { onSettled: () => setResuggestingSlot(null) }
    );
  };

  const handleRemove = (item: EnrichedDraftItem) => {
    if (!draft || isUpdatingItems || draft.items.length <= 1) return;
    updateItems({
      draftId: draft.id,
      items: removeDraftItem(draft.items, item.fecha, item.tipoComida),
    });
  };

  const handleDiscard = () => {
    if (!draft) return;
    discard(draft.id, { onSuccess: () => setStep("intent") });
  };

  const handleApply = () => {
    if (!draft) return;
    apply(draft.id, { onSuccess: () => onOpenChange(false) });
  };

  const handleApplyClick = () => {
    if (!draft) return;
    // Replacing the week deletes every planned meal and, in cascade, its
    // comments, stars and swap proposals — never apply that silently.
    if (draft.replaceWeek) {
      setShowReplaceConfirm(true);
      return;
    }
    handleApply();
  };

  // Items that block applying: a deleted main or side, or a main whose
  // categoria became "Acompañamiento" after generation (a side can never
  // stand alone). "Otra sugerencia" or the swap combobox are the fix paths.
  const hasBlockedItem = (draft?.items ?? []).some(
    (item) =>
      item.recipe === null ||
      (item.acompanamientoId != null && item.acompanamientoRecipe === null) ||
      isMainAcompanamiento(item)
  );

  // Manual-swap options: sides can never be a slot's main dish, so offering
  // them here would only earn a server-side 400.
  const recipeGroups = groupRecipesByCategory(
    (recipes ?? []).filter((recipe) => recipe.categoria !== "Acompañamiento")
  );

  const renderSlotRow = (label: string, fecha: string, tipoComida: "almuerzo" | "cena", item: EnrichedDraftItem | null) => {
    if (!draft) return null;
    const key = slotKey(fecha, tipoComida);
    const isRowResuggesting = resuggestingSlot === key;
    return (
      <div>
        <span className="text-xs text-gray-500">{label}</span>
        {item ? (
          <div className="mt-1 flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              {/* Searchable swap combobox (the modal sits at z-[60]; portal content needs z-[70]) */}
              <Popover open={openSwapSlot === key} onOpenChange={(isOpen) => setOpenSwapSlot(isOpen ? key : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSwapSlot === key}
                    aria-label={`Cambiar la receta del ${label.toLowerCase()}`}
                    disabled={isUpdatingItems || isRowResuggesting}
                    className="h-9 w-full justify-between px-3 text-sm font-normal bg-white"
                  >
                    <span className="truncate">
                      {isRowResuggesting ? "Buscando otra idea…" : item.recipe?.nombre ?? "Elegí una receta"}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[70] w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar receta…" />
                    <CommandList>
                      <CommandEmpty>No encontramos recetas con ese nombre.</CommandEmpty>
                      {recipeGroups.map((group) => (
                        <CommandGroup key={group.categoria} heading={group.categoria}>
                          {group.recipes.map((recipe) => (
                            <CommandItem
                              key={recipe.id}
                              value={`${recipe.nombre} ${recipe.id}`}
                              onSelect={() => {
                                setOpenSwapSlot(null);
                                handleSwap(item, recipe.id);
                              }}
                            >
                              <span className="truncate">{recipe.nombre}</span>
                              {recipe.id === item.recetaId && (
                                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-600" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {item.acompanamientoId != null &&
                (item.acompanamientoRecipe ? (
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    + {item.acompanamientoRecipe.nombre}{" "}
                    <span className="text-gray-400">[Acompañamiento]</span>
                  </p>
                ) : (
                  <p className="text-xs font-medium text-red-600 mt-1 leading-snug">
                    Acompañamiento eliminado — quitá esta comida del plan.
                  </p>
                ))}
              {!item.recipe && (
                <p className="text-xs font-medium text-red-600 mt-1 leading-snug">
                  Receta eliminada — elegí otra para este casillero.
                </p>
              )}
              {isMainAcompanamiento(item) && (
                <p className="text-xs font-medium text-red-600 mt-1 leading-snug">
                  Esta receta ahora es un acompañamiento y no puede ir sola. Elegí un plato principal.
                </p>
              )}
              {!draft.replaceWeek && occupiedKeys.has(slotKey(item.fecha, item.tipoComida)) && (
                <p className="text-xs font-medium text-amber-700 mt-1 leading-snug">
                  Ya planificado — esta sugerencia no se va a aplicar.
                </p>
              )}
              {item.razon && !isRowResuggesting && (
                <p className="text-xs text-gray-500 italic mt-1 leading-snug">{item.razon}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5 h-auto mt-1 text-gray-400 hover:text-amber-600 flex-shrink-0"
              onClick={() => handleResuggest(item)}
              disabled={isUpdatingItems || isResuggesting}
              title="Pedirle otra idea a Francis"
              aria-label={`Pedirle a Francis otra idea para el ${label.toLowerCase()}`}
            >
              {isRowResuggesting ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="p-1.5 h-auto mt-1 text-gray-400 hover:text-red-500 flex-shrink-0"
              onClick={() => handleRemove(item)}
              disabled={isUpdatingItems || draft.items.length <= 1}
              title={draft.items.length <= 1 ? "El borrador necesita al menos una comida" : "Quitar del plan"}
              aria-label={`Quitar ${item.recipe?.nombre ?? "la receta"} del ${label.toLowerCase()}`}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-gray-400 py-2">
            {!draft.replaceWeek && occupiedKeys.has(slotKey(fecha, tipoComida))
              ? "Ya planificado — se mantiene"
              : "Sin sugerencia"}
          </p>
        )}
      </div>
    );
  };

  const heightStyle = viewportHeight
    ? { height: `${viewportHeight}px`, top: 0 }
    : { top: 0, bottom: 0 };

  return (
    <div className="fixed left-0 right-0 z-[60] bg-white flex flex-col" style={heightStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-tinta/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-brasa" />
          <h2 className="font-bold text-base text-tinta">
            {step === "review" ? "El plan de Francis" : "Pedile a Francis"}
          </h2>
        </div>
        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => onOpenChange(false)}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {step === "generating" ? (
        <div className="flex-1 overflow-hidden px-4 pt-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-durazno-suave flex items-center justify-center text-xl flex-shrink-0" aria-hidden="true">
              👨‍🍳
            </div>
            <div>
              <h3 className="text-base font-bold text-tinta">Francis está armando la semana…</h3>
              <p className="text-xs text-tinta/60 leading-snug mt-0.5">
                Elige de tu recetario mirando las estrellas de los chicos y lo último que
                comieron. Puede tardar cerca de un minuto.
              </p>
            </div>
          </div>
          <div className="space-y-2.5" role="status" aria-label="Francis está armando el plan de la semana">
            {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((day, index) => (
              <div
                key={day}
                className="flex items-center gap-3 rounded-xl rounded-tr-[20px] border border-tinta/5 bg-papel p-3 animate-pulse"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <span className="w-9 text-xs font-bold text-tinta/40">{day}</span>
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 rounded bg-tinta/10 w-3/4"></div>
                  <div className="h-2.5 rounded bg-tinta/5 w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : step === "review" ? (
        !draft ? (
          isDraftLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : (
            /* The draft disappeared (resolved elsewhere or belongs to another
               week) — offer a way back instead of an endless spinner. */
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
              <p className="text-sm text-gray-500">No hay un borrador para esta semana.</p>
              <Button variant="outline" onClick={() => setStep("intent")}>
                Volver
              </Button>
            </div>
          )
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 min-h-0">
              <div className="space-y-3 py-3">
                {/* Replace-week drafts land here directly on reopen, skipping the
                    intent step — the destructive scope must be visible in review. */}
                {draft.replaceWeek && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-800 leading-snug">
                      Este plan regenera toda la semana: al aplicarlo se reemplazan las comidas
                      ya planificadas y se pierden sus comentarios, estrellas y propuestas de
                      cambio.
                    </p>
                  </div>
                )}

                {/* Summary card — Francis presents his plan */}
                {draft.summary && (
                  <div className="rounded-xl rounded-tr-[22px] border border-durazno bg-durazno-suave p-3 flex items-start gap-2.5 animate-rise-in">
                    <span className="text-lg leading-none flex-shrink-0" aria-hidden="true">👨‍🍳</span>
                    <p className="text-sm text-tinta leading-snug">{draft.summary}</p>
                  </div>
                )}

                {/* Day sections — Monday through Sunday, staggered entrance */}
                {groupDraftItemsByDay(draft.weekStartDate, draft.items).map((day, index) => (
                  <div
                    key={day.fecha}
                    className="rounded-xl rounded-tr-[22px] border border-tinta/10 bg-papel p-3 shadow-sm animate-rise-in"
                    style={{ animationDelay: `${Math.min(index * 80, 560)}ms` }}
                  >
                    <p className="text-sm font-bold text-tinta mb-2">
                      {formatDayHeading(day.fecha, index)}
                    </p>
                    <div className="space-y-2">
                      {renderSlotRow("Almuerzo", day.fecha, "almuerzo", day.almuerzo)}
                      {renderSlotRow("Cena", day.fecha, "cena", day.cena)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0 bg-white flex gap-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
              <Button
                variant="outline"
                onClick={() => setShowDiscardConfirm(true)}
                disabled={isDiscarding || isApplying}
                className="border-gray-300 text-gray-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Descartar
              </Button>
              <Button
                onClick={handleApplyClick}
                disabled={isApplying || isDiscarding || isUpdatingItems || isResuggesting || draft.items.length === 0 || hasBlockedItem}
                title={hasBlockedItem ? "Hay una comida que necesita arreglo: reemplazala o quitala" : undefined}
                className="flex-1 bg-brasa hover:bg-brasa/90 font-bold"
              >
                {isApplying ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Aplicando…</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Aplicar semana</>
                )}
              </Button>
            </div>
          </>
        )
      ) : (
        /* Intent step */
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 min-h-0">
            <div className="space-y-4 py-4">
              {isDraftLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : (
                <>
                  {/* Intro */}
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-durazno-suave flex items-center justify-center text-2xl" aria-hidden="true">
                      👨‍🍳
                    </div>
                    <p className="text-sm text-gray-500">
                      Francis elige recetas de tu biblioteca para completar las comidas de la
                      semana, mirando las estrellas de los chicos y lo que comieron últimamente.
                      Vos revisás el plan y lo ajustás antes de aplicarlo.
                    </p>
                  </div>

                  {/* Planner profile (persistent guidance) */}
                  <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
                    <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <span className="text-sm font-medium text-gray-700">Perfil del planificador</span>
                      {profileOpen ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pt-2 space-y-2">
                        <Textarea
                          value={promptDraft}
                          onChange={(e) => {
                            setPromptDraft(e.target.value);
                            setPromptDirty(true);
                          }}
                          maxLength={2000}
                          rows={3}
                          placeholder="Poca fritura, pescado una vez por semana, los viernes pizza…"
                          className="text-sm resize-none"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-500">
                            Guía permanente: se usa en todas las generaciones de tu familia.
                          </p>
                          {promptDirty && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs shrink-0"
                              disabled={isSavingPrompt}
                              onClick={() => savePrompt(promptDraft.trim(), { onSuccess: () => setPromptDirty(false) })}
                            >
                              {isSavingPrompt ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Guardando…</>
                              ) : (
                                "Guardar perfil"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* One-off instructions */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700" htmlFor="generate-week-instructions">
                      Instrucciones para esta semana
                    </label>
                    <Textarea
                      id="generate-week-instructions"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Contale a Francis qué querés para esta semana (opcional)…"
                      className="text-sm resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      {INSTRUCTION_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setInstructions(chip)}
                          className="text-xs px-3 py-2 rounded-full border border-durazno bg-durazno-suave text-tinta/80 hover:bg-durazno/40 active:bg-durazno/60 transition-colors text-left"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Replace-week switch — only when the week already has meals */}
                  {occupiedCount > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-gray-800">Regenerar toda la semana</span>
                        <Switch checked={replaceWeek} onCheckedChange={setReplaceWeek} />
                      </div>
                      <p className="text-xs text-amber-800">
                        {replaceWeek
                          ? "Al aplicar el plan se reemplazan todas las comidas ya planificadas de esta semana, junto con sus comentarios, estrellas y propuestas de cambio."
                          : "Si no lo activás, Francis solo completa los espacios vacíos y las comidas ya planificadas se mantienen."}
                      </p>
                      {weekIsFull && !replaceWeek && (
                        <p className="text-xs font-medium text-amber-900">
                          La semana ya está completa: activá esta opción para regenerarla.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0 bg-white" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isDraftLoading || (weekIsFull && !replaceWeek)}
              className="w-full bg-brasa hover:bg-brasa/90 text-white font-bold"
              size="lg"
            >
              <ChefHat className="w-4 h-4 mr-2" />
              Pedirle el plan a Francis
            </Button>
          </div>
        </>
      )}

      {/* Replace-week apply confirmation */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent className="z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar toda la semana?</AlertDialogTitle>
            <AlertDialogDescription>
              {occupiedCount > 0
                ? `Al aplicar este plan se elimina${occupiedCount === 1 ? " la comida ya planificada" : `n las ${occupiedCount} comidas ya planificadas`} de esta semana, junto con sus comentarios, estrellas y propuestas de cambio. Esta acción no se puede deshacer.`
                : "Este plan reemplaza todas las comidas de la semana. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isApplying}
              onClick={() => {
                handleApply();
                setShowReplaceConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Reemplazar semana
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard confirmation */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="z-[70]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina el plan propuesto por Francis. Las comidas ya planificadas no se tocan y
              podés generar un plan nuevo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDiscarding}
              onClick={() => {
                handleDiscard();
                setShowDiscardConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
