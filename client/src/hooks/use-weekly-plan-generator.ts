import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { jsonApiRequest } from "@/lib/queryClient";
import type { WeeklyPlanDraftItem } from "@shared/schema";
import { getWeekDateStrings } from "@shared/weekly-plan";

// ─── Types (mirror the server's enriched draft response) ────────────────────

export interface DraftRecipeSummary {
  id: number;
  nombre: string;
  categoria: string | null;
  calificacionNinos: number | null;
  esFavorita: number | null;
  tiempoPreparacion: number | null;
  imagen: string | null;
}

export interface EnrichedDraftItem {
  fecha: string;
  tipoComida: "almuerzo" | "cena";
  recetaId: number;
  razon?: string;
  /** Optional side dish ("Acompañamiento") served together with the main. */
  acompanamientoId: number | null;
  recipe: DraftRecipeSummary | null;
  /** null when there is no side or when the side recipe was deleted. */
  acompanamientoRecipe: DraftRecipeSummary | null;
}

export interface EnrichedWeeklyPlanDraft {
  id: number;
  weekStartDate: string;
  status: "pending" | "applied" | "discarded";
  replaceWeek: boolean;
  instructions: string | null;
  summary: string | null;
  model: string | null;
  createdAt: string;
  items: EnrichedDraftItem[];
}

export interface ApplyDraftResult {
  applied: number;
  skipped: number;
}

// Mirrors the server's resuggestSlotRequestSchema cap.
const MAX_AVOID_RECIPE_IDS = 50;

/**
 * Accumulates the per-slot avoid list for "Otra sugerencia": adds the current
 * pick before asking for a replacement, dedupes, and caps at the server's
 * limit (dropping the OLDEST rejections first — recent ones matter more).
 */
export function accumulateAvoidIds(previous: number[] | undefined, currentRecetaId: number): number[] {
  const merged = Array.from(new Set([...(previous ?? []), currentRecetaId]));
  return merged.slice(Math.max(0, merged.length - MAX_AVOID_RECIPE_IDS));
}

/**
 * True when the item's MAIN recipe is an "Acompañamiento" (e.g. its category
 * changed after generation) — a side can never stand alone as the meal, so
 * the item must be replaced before the draft can be applied.
 */
export function isMainAcompanamiento(item: Pick<EnrichedDraftItem, "recipe">): boolean {
  return item.recipe?.categoria === "Acompañamiento";
}

// ─── Pure helpers (exported for unit tests) ─────────────────────────────────

/**
 * Extracts the HTTP status from a jsonApiRequest error message
 * ("503: {...}" → 503). Returns null when the message has no status prefix.
 */
export function parseErrorStatus(message: string): number | null {
  const match = /^(\d{3}):/.exec(message);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts the server's Spanish `{ error: "..." }` message from a
 * jsonApiRequest error ("400: {\"error\":\"...\"}"). Returns null when the
 * body is not JSON or has no string `error` field.
 */
export function extractServerErrorMessage(message: string): string | null {
  const match = /^\d{3}:\s*([\s\S]*)$/.exec(message);
  if (!match) return null;
  try {
    const body = JSON.parse(match[1]);
    return typeof body?.error === "string" && body.error.length > 0 ? body.error : null;
  } catch {
    return null;
  }
}

/**
 * Maps an API error to friendly Spanish copy: 503 → AI service unavailable,
 * 429 → rate limit, otherwise the server's own message or the fallback.
 */
export function describeWeeklyPlanError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const status = parseErrorStatus(message);
  if (status === 503) {
    return "El servicio de IA no está disponible en este momento. Verificá que la API key esté configurada.";
  }
  if (status === 429) {
    return "Hiciste demasiadas generaciones seguidas. Esperá unos minutos e intentá de nuevo.";
  }
  return extractServerErrorMessage(message) ?? fallback;
}

/**
 * Success-toast copy for an applied draft. Surfaces the suggestions the server
 * skipped (their slot got occupied after generation) so the user knows the
 * review screen and the calendar can differ.
 */
export function describeApplyResult({ applied, skipped }: ApplyDraftResult): string {
  const appliedPart = `Se agregaron ${applied} comida${applied === 1 ? "" : "s"} al plan.`;
  if (skipped <= 0) return appliedPart;
  const skippedPart =
    skipped === 1
      ? "1 sugerencia no se aplicó porque ese casillero ya estaba ocupado."
      : `${skipped} sugerencias no se aplicaron porque esos casilleros ya estaban ocupados.`;
  return `${appliedPart} ${skippedPart}`;
}

export interface DraftDayGroup<T> {
  fecha: string;
  almuerzo: T | null;
  cena: T | null;
}

/**
 * Groups draft items into the week's 7 days (Monday..Sunday). Items outside
 * the week are ignored; on duplicates for the same slot the first one wins.
 */
export function groupDraftItemsByDay<T extends { fecha: string; tipoComida: string }>(
  weekStartDate: string,
  items: T[]
): DraftDayGroup<T>[] {
  return getWeekDateStrings(weekStartDate).map((fecha) => ({
    fecha,
    almuerzo: items.find((item) => item.fecha === fecha && item.tipoComida === "almuerzo") ?? null,
    cena: items.find((item) => item.fecha === fecha && item.tipoComida === "cena") ?? null,
  }));
}

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/**
 * Heading for a day section in the draft review: weekday name (by position
 * within the Monday-first week) + day-of-month taken straight from the
 * YYYY-MM-DD string — pure string math, no Date parsing, no TZ shifts.
 */
export function formatDayHeading(fecha: string, dayIndex: number): string {
  const dayName = DAY_NAMES[dayIndex] ?? "";
  const dayNumber = parseInt(fecha.slice(8, 10), 10);
  return `${dayName} ${dayNumber}`;
}

/** Strips the enrichment (recipe joins) down to the persistable draft items. */
export function toDraftItemsPayload(
  items: Array<{
    fecha: string;
    tipoComida: "almuerzo" | "cena";
    recetaId: number;
    razon?: string;
    acompanamientoId?: number | null;
  }>
): WeeklyPlanDraftItem[] {
  return items.map(({ fecha, tipoComida, recetaId, razon, acompanamientoId }) => ({
    fecha,
    tipoComida,
    recetaId,
    ...(typeof acompanamientoId === "number" ? { acompanamientoId } : {}),
    ...(razon !== undefined ? { razon } : {}),
  }));
}

/**
 * Returns the items payload with the (fecha, tipoComida) slot swapped to a
 * different main recipe. The AI's `razon` no longer applies to a manual swap,
 * so it is dropped for that item; an attached side is kept as-is.
 */
export function swapDraftItem(
  items: EnrichedDraftItem[],
  fecha: string,
  tipoComida: "almuerzo" | "cena",
  recetaId: number
): WeeklyPlanDraftItem[] {
  return toDraftItemsPayload(
    items.map((item) =>
      item.fecha === fecha && item.tipoComida === tipoComida
        ? {
            fecha: item.fecha,
            tipoComida: item.tipoComida,
            recetaId,
            acompanamientoId: item.acompanamientoId,
          }
        : item
    )
  );
}

/** Returns the items payload without the (fecha, tipoComida) slot. */
export function removeDraftItem(
  items: EnrichedDraftItem[],
  fecha: string,
  tipoComida: "almuerzo" | "cena"
): WeeklyPlanDraftItem[] {
  return toDraftItemsPayload(
    items.filter((item) => !(item.fecha === fecha && item.tipoComida === tipoComida))
  );
}

/**
 * Groups recipes by category for the swap Select, categories and recipes
 * alphabetized (es); recipes without category go last under "Sin categoría".
 */
export function groupRecipesByCategory<T extends { nombre: string; categoria: string | null }>(
  recipes: T[]
): Array<{ categoria: string; recipes: T[] }> {
  const groups = new Map<string, T[]>();
  for (const recipe of recipes) {
    const categoria = recipe.categoria || "Sin categoría";
    const group = groups.get(categoria);
    if (group) {
      group.push(recipe);
    } else {
      groups.set(categoria, [recipe]);
    }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === "Sin categoría") return 1;
      if (b === "Sin categoría") return -1;
      return a.localeCompare(b, "es");
    })
    .map(([categoria, groupRecipes]) => ({
      categoria,
      recipes: [...groupRecipes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Bundles the intelligent weekly plan generator's queries and mutations.
 * Pass `undefined` while the generator UI is closed to keep the queries idle.
 */
export function useWeeklyPlanGenerator(weekStartDate: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const draftKey = ["/api/weekly-plan/draft", { weekStartDate }] as const;

  /**
   * A 404 from apply/discard/update means the draft no longer exists server-side
   * (e.g. resolved from another device). The draft query is fresh forever, so
   * without clearing the cache here the UI would keep offering a ghost draft
   * whose every action 404s. Returns true when the error was handled.
   */
  const handleStaleDraftError = (error: Error): boolean => {
    if (parseErrorStatus(error.message) !== 404) return false;
    queryClient.setQueryData(draftKey, null);
    queryClient.invalidateQueries({ queryKey: ["/api/weekly-plan/draft"] });
    toast({
      title: "Este borrador ya no existe",
      description: "Puede que lo hayas aplicado o descartado desde otro dispositivo. Generá un plan nuevo cuando quieras.",
      variant: "destructive",
    });
    return true;
  };

  const draftQuery = useQuery<EnrichedWeeklyPlanDraft | null>({
    queryKey: draftKey,
    queryFn: async () => {
      if (!weekStartDate) return null;
      const params = new URLSearchParams({ weekStartDate });
      const response = await fetch(`/api/weekly-plan/draft?${params}`);
      if (!response.ok) throw new Error("Error al cargar el borrador de la semana");
      return response.json() as Promise<EnrichedWeeklyPlanDraft | null>;
    },
    enabled: !!weekStartDate,
    retry: false,
  });

  const plannerPromptQuery = useQuery<{ plannerPrompt: string | null }>({
    queryKey: ["/api/family/planner-prompt"],
    enabled: !!weekStartDate,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ instructions, replaceWeek }: { instructions?: string; replaceWeek?: boolean }) => {
      if (!weekStartDate) throw new Error("No se seleccionó una semana");
      const data = await jsonApiRequest<EnrichedWeeklyPlanDraft>("/api/weekly-plan/generate", {
        method: "POST",
        body: JSON.stringify({ weekStartDate, instructions, replaceWeek }),
      });
      // Capture the requested week: the user may navigate the calendar while
      // the generation is in flight, and onSuccess must never write this
      // draft under another week's cache key.
      return { requestedWeek: weekStartDate, data };
    },
    onSuccess: ({ requestedWeek, data }) => {
      queryClient.setQueryData(["/api/weekly-plan/draft", { weekStartDate: requestedWeek }], data);
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-plan/draft"] });
      toast({ title: "¡Plan generado! ✨", description: "Revisalo y ajustá lo que quieras." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al generar el plan",
        description: describeWeeklyPlanError(error, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  const updateItemsMutation = useMutation({
    mutationFn: async ({ draftId, items }: { draftId: number; items: WeeklyPlanDraftItem[] }) => {
      return await jsonApiRequest<EnrichedWeeklyPlanDraft>(`/api/weekly-plan/draft/${draftId}/items`, {
        method: "PUT",
        body: JSON.stringify({ items }),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(draftKey, data);
    },
    onError: (error: Error) => {
      if (handleStaleDraftError(error)) return;
      toast({
        title: "Error al actualizar el borrador",
        description: describeWeeklyPlanError(error, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  const resuggestMutation = useMutation({
    mutationFn: async ({
      draftId,
      fecha,
      tipoComida,
      avoidRecipeIds,
    }: {
      draftId: number;
      fecha: string;
      tipoComida: "almuerzo" | "cena";
      avoidRecipeIds: number[];
    }) => {
      return await jsonApiRequest<EnrichedWeeklyPlanDraft>(`/api/weekly-plan/draft/${draftId}/resuggest`, {
        method: "POST",
        body: JSON.stringify({ fecha, tipoComida, avoidRecipeIds }),
      });
    },
    onSuccess: (data) => {
      // The new pick lands in the cached draft; success is visible in the row.
      queryClient.setQueryData(draftKey, data);
    },
    onError: (error: Error) => {
      if (handleStaleDraftError(error)) return;
      toast({
        title: "No pudimos traer otra sugerencia",
        description: describeWeeklyPlanError(error, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (draftId: number) => {
      return await jsonApiRequest<ApplyDraftResult>(`/api/weekly-plan/draft/${draftId}/apply`, {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(draftKey, null);
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-plan/draft"] });
      toast({
        title: "Semana lista 🎉",
        description: describeApplyResult(data),
      });
    },
    onError: (error: Error) => {
      if (handleStaleDraftError(error)) return;
      toast({
        title: "Error al aplicar la semana",
        description: describeWeeklyPlanError(error, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (draftId: number) => {
      return await jsonApiRequest<{ ok: boolean }>(`/api/weekly-plan/draft/${draftId}/discard`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(draftKey, null);
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-plan/draft"] });
      toast({ title: "Borrador descartado" });
    },
    onError: (error: Error) => {
      if (handleStaleDraftError(error)) return;
      toast({
        title: "Error al descartar el borrador",
        description: describeWeeklyPlanError(error, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  const savePromptMutation = useMutation({
    mutationFn: async (plannerPrompt: string) => {
      return await jsonApiRequest<{ plannerPrompt: string }>("/api/family/planner-prompt", {
        method: "PATCH",
        body: JSON.stringify({ plannerPrompt }),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/family/planner-prompt"], data);
      toast({ title: "Perfil guardado ✅" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar el perfil",
        description: describeWeeklyPlanError(error, "Intentá de nuevo."),
        variant: "destructive",
      });
    },
  });

  return {
    draft: draftQuery.data ?? null,
    isDraftLoading: draftQuery.isLoading,
    plannerPrompt: plannerPromptQuery.data?.plannerPrompt ?? null,
    isPlannerPromptLoading: plannerPromptQuery.isLoading,
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    updateItems: updateItemsMutation.mutate,
    isUpdatingItems: updateItemsMutation.isPending,
    resuggest: resuggestMutation.mutate,
    isResuggesting: resuggestMutation.isPending,
    apply: applyMutation.mutate,
    isApplying: applyMutation.isPending,
    discard: discardMutation.mutate,
    isDiscarding: discardMutation.isPending,
    savePrompt: savePromptMutation.mutate,
    isSavingPrompt: savePromptMutation.isPending,
  };
}
