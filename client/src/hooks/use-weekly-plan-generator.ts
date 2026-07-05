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
  recipe: DraftRecipeSummary | null;
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
    return "Hiciste demasiadas generaciones seguidas. Esperá un momento e intentá de nuevo.";
  }
  return extractServerErrorMessage(message) ?? fallback;
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

/** Strips the enrichment (recipe join) down to the persistable draft items. */
export function toDraftItemsPayload(
  items: Array<{ fecha: string; tipoComida: "almuerzo" | "cena"; recetaId: number; razon?: string }>
): WeeklyPlanDraftItem[] {
  return items.map(({ fecha, tipoComida, recetaId, razon }) => ({
    fecha,
    tipoComida,
    recetaId,
    ...(razon !== undefined ? { razon } : {}),
  }));
}

/**
 * Returns the items payload with the (fecha, tipoComida) slot swapped to a
 * different recipe. The AI's `razon` no longer applies to a manual swap, so
 * it is dropped for that item.
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
        ? { fecha: item.fecha, tipoComida: item.tipoComida, recetaId }
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
      return await jsonApiRequest<EnrichedWeeklyPlanDraft>("/api/weekly-plan/generate", {
        method: "POST",
        body: JSON.stringify({ weekStartDate, instructions, replaceWeek }),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(draftKey, data);
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
      toast({
        title: "Error al actualizar el borrador",
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
        description: `Se agregaron ${data.applied} comida${data.applied === 1 ? "" : "s"} al plan.`,
      });
    },
    onError: (error: Error) => {
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
    apply: applyMutation.mutate,
    isApplying: applyMutation.isPending,
    discard: discardMutation.mutate,
    isDiscarding: discardMutation.isPending,
    savePrompt: savePromptMutation.mutate,
    isSavingPrompt: savePromptMutation.isPending,
  };
}
