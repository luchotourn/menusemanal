/**
 * LLM-powered weekly plan generator service.
 * Uses Claude to fill the week's empty meal slots (or the whole week) by
 * SELECTING recipe ids from the family's own library, weighing kid ratings,
 * family ratings, serving history and commentator feedback. The result is a
 * draft that a human reviews and applies — this service never writes to the DB.
 *
 * Note on output parsing: the pinned design asked for SDK structured outputs
 * via `zodOutputFormat`, but the helper shipped in @anthropic-ai/sdk 0.87 runs
 * on `zod/v4` internals while this project authors schemas with zod v3 classic
 * (a v3 schema crashes at runtime, a zod/v4 schema fails the typecheck). We
 * therefore fall back to the house fenced-JSON contract: exactly one ```json
 * block, strict JSON.parse + zod validation, null on malformation, and no
 * regex fallback (same security posture as recipe-assistant.ts).
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { WeeklyPlanDraftItem } from '@shared/schema';
import { slotKey, type WeekSlot } from '@shared/weekly-plan';

export const WEEKLY_PLAN_MODEL = 'claude-opus-4-8';
const MAX_OUTPUT_TOKENS = 16000;
const MAX_RAZON_LENGTH = 300;
const MAX_COMMENT_SNIPPETS = 2;
const MAX_SNIPPET_LENGTH = 80;

// ─────────────────────────────────────────────
// Raw input rows (as fetched by the route from storage — kept structural so
// the service stays free of storage/db imports and is trivially testable)
// ─────────────────────────────────────────────

export interface RecipeRow {
  id: number;
  nombre: string;
  categoria: string;
  calificacionNinos: number | null;
  esFavorita: number | null;
  tiempoPreparacion: number | null;
}

export interface RatingRow {
  recipeId: number;
  rating: number;
}

export interface HistoryRow {
  fecha: string; // YYYY-MM-DD
  recetaId: number | null;
}

export interface CommentRow {
  recipeId: number | null;
  comment: string;
}

export interface ProposalRow {
  proposedRecipeId: number;
  status: string; // "pending" | "accepted" | "rejected"
  reason: string | null;
}

export interface ReviewVerdict {
  weekStartDate: string;
  status: string; // "submitted" | "approved" | "changes_requested"
}

export interface SignoffNote {
  userName: string;
  verdict: string; // "approved" | "changes_requested"
  note: string | null;
}

/** One fully-enriched recipe line ready for the prompt. */
export interface RecipeLibraryEntry {
  id: number;
  nombre: string;
  categoria: string;
  calificacionNinos: number | null;
  esFavorita: boolean;
  tiempoPreparacion: number | null;
  avgUserRating: number | null;
  timesServedLast8Weeks: number;
  lastServedFecha: string | null;
  commentSnippets: string[];
  proposedCount: number;
  proposalAcceptedCount: number;
  proposalRejectedCount: number;
  proposalReasons: string[];
}

// ─────────────────────────────────────────────
// Pure context builders
// ─────────────────────────────────────────────

/** Aggregates serve counts and last-served date per recipe from meal-plan history rows.
 *  YYYY-MM-DD strings compare lexicographically, so no Date parsing is needed. */
export function computeRecipeServeStats(
  history: HistoryRow[],
): Map<number, { timesServed: number; lastServedFecha: string }> {
  const stats = new Map<number, { timesServed: number; lastServedFecha: string }>();
  for (const row of history) {
    if (row.recetaId == null) continue;
    const current = stats.get(row.recetaId);
    if (current) {
      current.timesServed += 1;
      if (row.fecha > current.lastServedFecha) current.lastServedFecha = row.fecha;
    } else {
      stats.set(row.recetaId, { timesServed: 1, lastServedFecha: row.fecha });
    }
  }
  return stats;
}

function truncateSnippet(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_SNIPPET_LENGTH ? `${clean.slice(0, MAX_SNIPPET_LENGTH - 1)}…` : clean;
}

/** Merges raw storage rows into per-recipe prompt entries. Pure. */
export function buildRecipeLibraryEntries(input: {
  recipes: RecipeRow[];
  ratings: RatingRow[];
  history: HistoryRow[];
  comments: CommentRow[];
  proposals: ProposalRow[];
}): RecipeLibraryEntry[] {
  const serveStats = computeRecipeServeStats(input.history);

  const ratingAgg = new Map<number, { total: number; count: number }>();
  for (const rating of input.ratings) {
    const agg = ratingAgg.get(rating.recipeId);
    if (agg) {
      agg.total += rating.rating;
      agg.count += 1;
    } else {
      ratingAgg.set(rating.recipeId, { total: rating.rating, count: 1 });
    }
  }

  const commentsByRecipe = new Map<number, string[]>();
  for (const comment of input.comments) {
    if (comment.recipeId == null || !comment.comment.trim()) continue;
    const list = commentsByRecipe.get(comment.recipeId) ?? [];
    list.push(truncateSnippet(comment.comment));
    commentsByRecipe.set(comment.recipeId, list);
  }

  const proposalsByRecipe = new Map<number, { proposed: number; accepted: number; rejected: number; reasons: string[] }>();
  for (const proposal of input.proposals) {
    const agg = proposalsByRecipe.get(proposal.proposedRecipeId) ?? {
      proposed: 0,
      accepted: 0,
      rejected: 0,
      reasons: [],
    };
    agg.proposed += 1;
    if (proposal.status === 'accepted') agg.accepted += 1;
    if (proposal.status === 'rejected') agg.rejected += 1;
    if (proposal.reason?.trim()) agg.reasons.push(truncateSnippet(proposal.reason));
    proposalsByRecipe.set(proposal.proposedRecipeId, agg);
  }

  return input.recipes.map((recipe) => {
    const stats = serveStats.get(recipe.id);
    const rating = ratingAgg.get(recipe.id);
    const proposalAgg = proposalsByRecipe.get(recipe.id);
    return {
      id: recipe.id,
      nombre: recipe.nombre,
      categoria: recipe.categoria,
      calificacionNinos: recipe.calificacionNinos,
      esFavorita: recipe.esFavorita === 1,
      tiempoPreparacion: recipe.tiempoPreparacion,
      avgUserRating: rating ? Math.round((rating.total / rating.count) * 10) / 10 : null,
      timesServedLast8Weeks: stats?.timesServed ?? 0,
      lastServedFecha: stats?.lastServedFecha ?? null,
      commentSnippets: (commentsByRecipe.get(recipe.id) ?? []).slice(-MAX_COMMENT_SNIPPETS),
      proposedCount: proposalAgg?.proposed ?? 0,
      proposalAcceptedCount: proposalAgg?.accepted ?? 0,
      proposalRejectedCount: proposalAgg?.rejected ?? 0,
      proposalReasons: (proposalAgg?.reasons ?? []).slice(-MAX_COMMENT_SNIPPETS),
    };
  });
}

/** Compact one-line-per-recipe summary for the prompt. */
export function buildRecipeLine(entry: RecipeLibraryEntry): string {
  const parts: string[] = [`[${entry.id}] ${entry.nombre} — ${entry.categoria}`];
  if (entry.calificacionNinos != null && entry.calificacionNinos > 0) {
    parts.push(`niños:${entry.calificacionNinos}/5`);
  }
  if (entry.avgUserRating != null) {
    parts.push(`familia:${entry.avgUserRating}/5`);
  }
  if (entry.esFavorita) parts.push('⭐favorita');
  if (entry.tiempoPreparacion != null) parts.push(`${entry.tiempoPreparacion}min`);
  parts.push(
    entry.timesServedLast8Weeks > 0
      ? `servida ${entry.timesServedLast8Weeks}x en 8 semanas (última: ${entry.lastServedFecha})`
      : 'no servida en 8 semanas',
  );
  if (entry.commentSnippets.length > 0) {
    parts.push(`comentarios: ${entry.commentSnippets.map((snippet) => `"${snippet}"`).join(' / ')}`);
  }
  if (entry.proposedCount > 0) {
    const outcomes: string[] = [];
    if (entry.proposalAcceptedCount > 0) outcomes.push(`${entry.proposalAcceptedCount} aceptada(s)`);
    if (entry.proposalRejectedCount > 0) outcomes.push(`${entry.proposalRejectedCount} rechazada(s)`);
    let proposalPart = `pedida como cambio ${entry.proposedCount}x`;
    if (outcomes.length > 0) proposalPart += ` (${outcomes.join(', ')})`;
    if (entry.proposalReasons.length > 0) {
      proposalPart += `: ${entry.proposalReasons.map((reason) => `"${reason}"`).join(' / ')}`;
    }
    parts.push(proposalPart);
  }
  return parts.join(' | ');
}

const SPANISH_DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Spanish weekday for a YYYY-MM-DD string. UTC-only parse (see shared/weekly-plan.ts). */
export function dayNameFor(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return SPANISH_DAY_NAMES[date.getUTCDay()];
}

/** Lists the exact slots the model must fill, one per line. */
export function buildSlotsSection(slots: WeekSlot[]): string {
  return slots
    .map((slot) => `- ${dayNameFor(slot.fecha)} ${slot.fecha} — ${slot.tipoComida}`)
    .join('\n');
}

/** Recent weekly-review verdicts + the current week's signoff notes. */
export function buildReviewSection(recentReviews: ReviewVerdict[], signoffNotes: SignoffNote[]): string {
  const lines: string[] = [];
  if (recentReviews.length > 0) {
    lines.push('Revisiones semanales recientes:');
    for (const review of recentReviews) {
      lines.push(`- semana ${review.weekStartDate}: ${review.status}`);
    }
  }
  const notesWithText = signoffNotes.filter((signoff) => signoff.note?.trim());
  if (notesWithText.length > 0) {
    lines.push('Notas de la revisión de esta semana:');
    for (const signoff of notesWithText) {
      lines.push(`- ${signoff.userName} (${signoff.verdict}): "${truncateSnippet(signoff.note!)}"`);
    }
  }
  return lines.join('\n');
}

export interface WeeklyPlanPromptInput {
  weekStartDate: string;
  slots: WeekSlot[];
  library: RecipeLibraryEntry[];
  recentReviews: ReviewVerdict[];
  signoffNotes: SignoffNote[];
  plannerPrompt: string | null;
  instructions: string | null;
}

/** Assembles the full user message for the generation call. Pure. */
export function buildWeeklyPlanUserMessage(input: WeeklyPlanPromptInput): string {
  const sections: string[] = [];

  sections.push(`SEMANA A PLANIFICAR: lunes ${input.weekStartDate}`);

  if (input.plannerPrompt?.trim()) {
    sections.push(`PERFIL DE LA FAMILIA (respetalo siempre):\n"${input.plannerPrompt.trim()}"`);
  }

  if (input.instructions?.trim()) {
    sections.push(`INSTRUCCIONES PARA ESTA SEMANA (prioridad máxima):\n"${input.instructions.trim()}"`);
  }

  sections.push(
    `CASILLEROS A COMPLETAR (${input.slots.length}) — completá EXACTAMENTE estos, ni más ni menos:\n${buildSlotsSection(input.slots)}`,
  );

  sections.push(
    `BIBLIOTECA DE RECETAS DE LA FAMILIA (${input.library.length} recetas — usá SOLO estos recetaId):\n${input.library
      .map(buildRecipeLine)
      .join('\n')}`,
  );

  const reviewSection = buildReviewSection(input.recentReviews, input.signoffNotes);
  if (reviewSection) {
    sections.push(`SEÑALES DE LA FAMILIA:\n${reviewSection}`);
  }

  sections.push('Armá el plan y devolvé el JSON con el formato pedido.');

  return sections.join('\n\n');
}

export const WEEKLY_PLAN_SYSTEM_PROMPT = `Sos el planificador de comidas de una familia en la app "Menú Familiar".
Tu trabajo es armar el menú de la semana eligiendo recetas de la biblioteca de la familia.

REGLAS:
- Respondé siempre en español rioplatense (vos, usá, elegí).
- Completá EXACTAMENTE los casilleros pedidos: ni más, ni menos, ni otros días u horarios.
- Usá SOLO valores de recetaId que aparezcan en la biblioteca provista. NUNCA inventes ids.
- No repitas una receta en la misma semana. Única excepción: si la biblioteca tiene menos recetas que casilleros; en ese caso repetí lo mínimo posible y aclaralo en el resumen.
- Evitá recetas servidas en las últimas 2 semanas, salvo que sean favoritas con calificación muy alta.
- Dale mucho peso a la calificación de los niños y a las calificaciones de la familia, pero incluí 1 o 2 elecciones más audaces para variar.
- Equilibrá las categorías a lo largo de la semana: que no se repita el mismo tipo de plato todos los días.
- Preferí cenas más livianas que los almuerzos.
- El perfil de la familia y las instrucciones de esta semana están por encima de cualquier otra regla de preferencia.
- "razon": UNA sola oración corta y cálida dirigida a quien planifica, en voseo.
- "resumen": breve (2 o 3 oraciones), en voseo, contando el criterio general de la semana.

FORMATO DE RESPUESTA:
Una oración breve de contexto y después EXACTAMENTE un bloque JSON entre \`\`\`json y \`\`\`:
\`\`\`json
{"resumen": "...", "items": [{"fecha": "YYYY-MM-DD", "tipoComida": "almuerzo", "recetaId": 12, "razon": "..."}]}
\`\`\``;

/** Corrective follow-up when the first response missed slots or used invalid ids. */
export function buildRetryMessage(missingSlots: WeekSlot[]): string {
  return `Tu respuesta anterior no sirvió tal cual: dejó casilleros sin cubrir o usó recetaId que no están en la biblioteca, o repitió recetas.
Casilleros que quedaron sin cubrir:
${buildSlotsSection(missingSlots)}

Devolvé el plan COMPLETO de nuevo (todos los casilleros pedidos originalmente), usando SOLO recetaId de la biblioteca y sin repetir recetas. Un solo bloque \`\`\`json.`;
}

// ─────────────────────────────────────────────
// Output parsing & validation
// ─────────────────────────────────────────────

// razon is validated without a max here: an over-long razon gets truncated in
// validatePlanItems instead of invalidating the whole plan.
const weeklyPlanOutputSchema = z.object({
  resumen: z.string(),
  items: z.array(
    z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      tipoComida: z.enum(['almuerzo', 'cena']),
      recetaId: z.number().int().positive(),
      razon: z.string().optional(),
    }),
  ),
});

export type WeeklyPlanModelOutput = z.infer<typeof weeklyPlanOutputSchema>;

/** Extracts and validates the plan from the LLM response.
 *  Strict: first \`\`\`json block only, JSON.parse + zod, null on any malformation.
 *  Deliberately no regex/number fallback (same security posture as recipe-assistant). */
export function parseWeeklyPlanResponse(response: string): WeeklyPlanModelOutput | null {
  const jsonMatch = response.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    const result = weeklyPlanOutputSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // Don't fall back to looser extraction — it could fabricate a wrong plan
    console.warn('Failed to parse weekly plan JSON from LLM response');
  }
  return null;
}

export interface ValidatedPlan {
  items: WeeklyPlanDraftItem[];
  missingSlots: WeekSlot[];
}

/**
 * Post-validates model items against the requested slots and the family library:
 * - drops items for slots that weren't requested (extras) and duplicate slot fills;
 * - drops items whose recetaId is not in the library (invented ids);
 * - dedupes recipes within the week when the library is large enough to allow it;
 * - truncates razon to the draft item limit.
 * Returns the accepted items in canonical slot order plus the slots left unfilled.
 */
export function validatePlanItems(
  items: WeeklyPlanModelOutput['items'],
  requestedSlots: WeekSlot[],
  libraryIds: Set<number>,
): ValidatedPlan {
  const allowDuplicates = libraryIds.size < requestedSlots.length;
  const requestedKeys = new Set(requestedSlots.map((slot) => slotKey(slot.fecha, slot.tipoComida)));
  const acceptedBySlot = new Map<string, WeeklyPlanDraftItem>();
  const usedRecipeIds = new Set<number>();

  for (const item of items) {
    const key = slotKey(item.fecha, item.tipoComida);
    if (!requestedKeys.has(key)) continue; // extra slot — drop
    if (acceptedBySlot.has(key)) continue; // duplicate fill for the same slot — drop
    if (!libraryIds.has(item.recetaId)) continue; // invented recipe id — drop
    if (!allowDuplicates && usedRecipeIds.has(item.recetaId)) continue; // repeated recipe — drop

    acceptedBySlot.set(key, {
      fecha: item.fecha,
      tipoComida: item.tipoComida,
      recetaId: item.recetaId,
      ...(item.razon?.trim() ? { razon: truncateRazon(item.razon) } : {}),
    });
    usedRecipeIds.add(item.recetaId);
  }

  const orderedItems: WeeklyPlanDraftItem[] = [];
  const missingSlots: WeekSlot[] = [];
  for (const slot of requestedSlots) {
    const accepted = acceptedBySlot.get(slotKey(slot.fecha, slot.tipoComida));
    if (accepted) orderedItems.push(accepted);
    else missingSlots.push(slot);
  }

  return { items: orderedItems, missingSlots };
}

function truncateRazon(razon: string): string {
  const clean = razon.trim();
  return clean.length > MAX_RAZON_LENGTH ? clean.slice(0, MAX_RAZON_LENGTH) : clean;
}

// ─────────────────────────────────────────────
// Apply-time merge semantics (pure — the route runs these inside its transaction)
// ─────────────────────────────────────────────

export interface ApplyPlanResult {
  toInsert: WeeklyPlanDraftItem[];
  skipped: number;
  clearWeekFirst: boolean;
}

/**
 * Decides what applying a draft writes:
 * - replaceWeek: clear the family's week first and insert every draft item;
 * - fill-empty: insert only items whose slot is still free, count the rest as skipped.
 */
export function planApplyOperations(
  items: WeeklyPlanDraftItem[],
  occupied: { fecha: string; tipoComida: string }[],
  replaceWeek: boolean,
): ApplyPlanResult {
  if (replaceWeek) {
    return { toInsert: items, skipped: 0, clearWeekFirst: true };
  }
  const occupiedKeys = new Set(occupied.map((slot) => slotKey(slot.fecha, slot.tipoComida)));
  const toInsert = items.filter((item) => !occupiedKeys.has(slotKey(item.fecha, item.tipoComida)));
  return { toInsert, skipped: items.length - toInsert.length, clearWeekFirst: false };
}

// ─────────────────────────────────────────────
// Generation (the only API-calling function)
// ─────────────────────────────────────────────

export interface GeneratedWeeklyPlan {
  resumen: string;
  items: WeeklyPlanDraftItem[];
  model: string;
}

async function callModel(client: Anthropic, messages: Anthropic.MessageParam[]): Promise<string> {
  const response = await client.messages.create({
    model: WEEKLY_PLAN_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: 'adaptive' },
    system: WEEKLY_PLAN_SYSTEM_PROMPT,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * Asks Claude to fill the requested slots with recipes from the family library.
 * Retries ONCE with a corrective follow-up when the first answer leaves slots
 * unfilled (or unusable); still-incomplete output throws GENERATION_INCOMPLETE.
 */
export async function generateWeeklyPlan(input: WeeklyPlanPromptInput): Promise<GeneratedWeeklyPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });
  const libraryIds = new Set(input.library.map((entry) => entry.id));
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildWeeklyPlanUserMessage(input) },
  ];

  const firstResponse = await callModel(client, messages);
  let parsed = parseWeeklyPlanResponse(firstResponse);
  let resumen = parsed?.resumen?.trim() ?? '';
  let validated = parsed
    ? validatePlanItems(parsed.items, input.slots, libraryIds)
    : { items: [], missingSlots: [...input.slots] };

  if (validated.missingSlots.length > 0) {
    messages.push({ role: 'assistant', content: firstResponse });
    messages.push({ role: 'user', content: buildRetryMessage(validated.missingSlots) });

    const retryResponse = await callModel(client, messages);
    parsed = parseWeeklyPlanResponse(retryResponse);
    if (parsed) {
      if (parsed.resumen.trim()) resumen = parsed.resumen.trim();
      validated = validatePlanItems(parsed.items, input.slots, libraryIds);
    } else {
      validated = { items: [], missingSlots: [...input.slots] };
    }

    if (validated.missingSlots.length > 0) {
      throw new Error('GENERATION_INCOMPLETE');
    }
  }

  return { resumen, items: validated.items, model: WEEKLY_PLAN_MODEL };
}
