/**
 * LLM-powered recipe assistant service.
 * Uses Claude to analyze user preferences (in natural language) and select
 * the best recipes from the master catalog for their family.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface MasterRecipe {
  nombre: string;
  descripcion: string;
  imagen: string;
  enlaceExterno: string;
  categoria: string;
  ingredientes: string[];
  instrucciones: string;
  tiempoPreparacion: number | null;
  porciones: number | null;
  tags: string[];
  dieta: string | null;
  containsAlcohol?: boolean;
  isFullMeal?: boolean;
  kidFriendly?: boolean;
}

export interface SuggestedRecipe extends MasterRecipe {
  catalogIndex: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Indexed catalog entry — preserves original index after filtering
interface IndexedRecipe {
  originalIndex: number;
  recipe: MasterRecipe;
}

// Load master catalog once at module level
let masterCatalog: MasterRecipe[] | null = null;

function loadMasterCatalog(): MasterRecipe[] {
  if (!masterCatalog) {
    const catalogPath = resolve(process.cwd(), 'server', 'data', 'master-recipes.json');
    const raw = readFileSync(catalogPath, 'utf-8');
    masterCatalog = JSON.parse(raw) as MasterRecipe[];
  }
  return masterCatalog;
}

// Keywords that signal kid-related requests
const KID_KEYWORDS = /\b(niño|niña|nene|nena|chico|chica|hijo|hija|kid|children|infantil|familia con (chicos|niños|hijos)|años)\b/i;

// Keywords that signal meals-only (not drinks/condiments)
const MEAL_KEYWORDS = /\b(comida|almuerzo|cena|plato|menú|cocinar|receta|meal)\b/i;

/** Pre-filter catalog based on detected intent in user preferences */
function preFilterCatalog(catalog: MasterRecipe[], preferences: string): IndexedRecipe[] {
  const wantsKidFriendly = KID_KEYWORDS.test(preferences);
  const wantsMeals = MEAL_KEYWORDS.test(preferences) || wantsKidFriendly;

  return catalog
    .map((recipe, i) => ({ originalIndex: i, recipe }))
    .filter(({ recipe }) => {
      // Always filter out non-meals unless user specifically asks for drinks/condiments
      if (wantsMeals && recipe.isFullMeal === false) return false;
      // Filter out alcohol for kid requests
      if (wantsKidFriendly && recipe.containsAlcohol) return false;
      return true;
    });
}

/** Extract the 3-4 main ingredients, stripping quantities */
function summarizeIngredients(ingredientes: string[]): string {
  if (!ingredientes || ingredientes.length === 0) return '';
  return ingredientes
    .slice(0, 4)
    .map(ing => {
      // Strip leading quantities: "200 g de", "1 cda. de", "2 u de", "4 Dientes de", "1/2 Cebolla"
      return ing
        .replace(/^[\d/.,]+\s*(g|kg|ml|l|u|cdas?\.?|cdtas?\.?|ramitas?|pizca|c\/n|dientes?|hojas?|rodajas?|fetas?|lonjas?|latas?)?\s*(de\s+)?/i, '')
        .replace(/\s*(a gusto|c\/n)$/i, '')
        .trim();
    })
    .filter(Boolean)
    .join(', ');
}

/** Build a compact catalog summary for the LLM prompt, using original indices */
function buildCatalogSummary(indexed: IndexedRecipe[]): string {
  return indexed.map(({ originalIndex, recipe: r }) => {
    const time = r.tiempoPreparacion ? `${r.tiempoPreparacion}min` : '?';
    const diet = r.dieta ? ` [${r.dieta}]` : '';
    const portions = r.porciones ? ` (${r.porciones} porc.)` : '';
    const flags = [
      r.containsAlcohol ? 'ALCOHOL' : '',
      r.kidFriendly === false ? 'NO-KIDS' : '',
      r.isFullMeal === false ? 'COMPONENTE' : '',
    ].filter(Boolean).join(', ');
    const flagStr = flags ? ` ⚠️${flags}` : '';
    const tags = r.tags.length > 0 ? ` | ${r.tags.join(', ')}` : '';
    const mainIngr = summarizeIngredients(r.ingredientes);
    const ingrStr = mainIngr ? ` — Ingredientes: ${mainIngr}` : '';
    return `[${originalIndex}] ${r.nombre} — ${r.categoria}, ${time}${portions}${diet}${flagStr}${tags}${ingrStr}`;
  }).join('\n');
}

const SYSTEM_PROMPT = `Sos un asistente de cocina para una app de planificación de menú familiar llamada "Menú Familiar".
Tu trabajo es elegir recetas de un catálogo pre-filtrado para una familia.

REGLAS:
- Respondé siempre en español rioplatense (vos, usá, etc.)
- Sé MUY breve. Una oración de contexto y el JSON. Nada más.
- SIEMPRE seleccioná recetas y devolvé el JSON. NUNCA hagas preguntas.
- Devolvé EXACTAMENTE un bloque JSON con los índices elegidos entre \`\`\`json y \`\`\`
- CANTIDAD de recetas a devolver:
  - Si el usuario pide un número exacto ("sugerí 3 platos de pasta"), devolvé esa cantidad
  - Si el pedido implica planificación semanal ("menú para la semana", "comidas para la semana"), devolvé 7 (una por día)
  - Si es un pedido genérico sin cantidad ("postres con chocolate", "algo con pollo"), devolvé entre 3 y 5
- Priorizá variedad: distintas categorías, tiempos de cocción, y tipos de comida
- NUNCA selecciones recetas marcadas con ⚠️ALCOHOL si el pedido es para niños o familias con chicos
- NUNCA selecciones recetas marcadas con ⚠️COMPONENTE como plato principal
- Si el usuario pide cambios, ajustá manteniendo las que no se pidió cambiar
- Si el usuario pide agregar recetas, sumá esas al listado existente

FORMATO:
1. Una oración breve sobre lo que elegiste
2. El JSON:
\`\`\`json
{"selected": [0, 3, 5, 7, ...]}
\`\`\``;

function buildInitialUserMessage(preferences: string, existingRecipeNames: string[], filtered: IndexedRecipe[]): string {
  const catalogSummary = buildCatalogSummary(filtered);
  const existing = existingRecipeNames.length > 0
    ? `\n\nRECETAS QUE YA TIENE LA FAMILIA (NO incluir estas):\n${existingRecipeNames.map(n => `- ${n}`).join('\n')}`
    : '';

  return `El usuario describió sus preferencias así:
"${preferences}"
${existing}

CATÁLOGO DISPONIBLE (${filtered.length} recetas, ya pre-filtrado):
${catalogSummary}

Seleccioná las mejores recetas según la cantidad apropiada para el pedido. Usá los índices [N] del catálogo.`;
}

function buildRefineMessage(feedback: string): string {
  return `El usuario quiere cambios en la selección:
"${feedback}"

Ajustá la selección de 20 recetas según este pedido. Mostrá la nueva selección completa.`;
}

/** Extract selected recipe indices from LLM response */
export function parseSelectedIndices(response: string): number[] | null {
  const jsonMatch = response.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (Array.isArray(parsed.selected)) {
      return parsed.selected.filter((i: any) => typeof i === 'number');
    }
  } catch {
    // Don't fallback to regex extraction — it could pick up wrong numbers
    console.warn('Failed to parse recipe selection JSON from LLM response');
  }
  return null;
}

const MAX_CONVERSATION_TURNS = 10;
const MAX_INPUT_LENGTH = 2000;

/** Validate and sanitize conversation history from the client */
export function validateConversationHistory(history: unknown): ConversationMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .slice(0, MAX_CONVERSATION_TURNS * 2) // Cap total turns
    .filter((msg): msg is ConversationMessage =>
      msg != null &&
      typeof msg === 'object' &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string' &&
      msg.content.length <= 10000 // Cap individual message size
    )
    .map(msg => ({ role: msg.role, content: msg.content })); // Strip any extra fields
}

export async function suggestRecipes(
  preferences: string,
  existingRecipeNames: string[],
): Promise<{ message: string; recipes: SuggestedRecipe[]; conversationHistory: ConversationMessage[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });
  const catalog = loadMasterCatalog();

  // Layer 2: Pre-filter catalog based on detected intent
  const filtered = preFilterCatalog(catalog, preferences);

  const userMessage = buildInitialUserMessage(preferences, existingRecipeNames, filtered);
  const conversationHistory: ConversationMessage[] = [
    { role: 'user', content: userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: conversationHistory,
  });

  const assistantMessage = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  conversationHistory.push({ role: 'assistant', content: assistantMessage });

  const indices = parseSelectedIndices(assistantMessage);
  const recipes: SuggestedRecipe[] = indices
    ? indices
        .filter(i => i >= 0 && i < catalog.length)
        .map(i => ({ ...catalog[i], catalogIndex: i }))
    : [];

  // Strip the JSON block from the user-facing message
  const cleanMessage = assistantMessage.replace(/```json[\s\S]*?```/, '').trim();

  return { message: cleanMessage, recipes, conversationHistory };
}

export async function refineRecipes(
  feedback: string,
  rawConversationHistory: unknown,
  existingRecipeNames: string[],
): Promise<{ message: string; recipes: SuggestedRecipe[]; conversationHistory: ConversationMessage[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey });
  const catalog = loadMasterCatalog();

  // Validate and clone — never mutate the caller's array
  const history = validateConversationHistory(rawConversationHistory);

  const userMessage = buildRefineMessage(feedback);
  history.push({ role: 'user', content: userMessage });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: history,
  });

  const assistantMessage = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  history.push({ role: 'assistant', content: assistantMessage });

  const indices = parseSelectedIndices(assistantMessage);
  const recipes: SuggestedRecipe[] = indices
    ? indices
        .filter(i => i >= 0 && i < catalog.length)
        .map(i => ({ ...catalog[i], catalogIndex: i }))
    : [];

  const cleanMessage = assistantMessage.replace(/```json[\s\S]*?```/, '').trim();

  return { message: cleanMessage, recipes, conversationHistory: history };
}

/** Get full recipe details for approved recipes, ready for DB insertion */
export function getRecipesForInsertion(
  catalogIndices: number[],
  userId: number,
  familyId: number,
): Array<{
  nombre: string;
  descripcion: string | null;
  imagen: string | null;
  enlaceExterno: string | null;
  categoria: string;
  ingredientes: string[] | null;
  instrucciones: string | null;
  tiempoPreparacion: number | null;
  porciones: number | null;
  esFavorita: number;
  userId: number;
  createdBy: number;
  familyId: number;
}> {
  const catalog = loadMasterCatalog();

  return catalogIndices
    .filter(i => i >= 0 && i < catalog.length)
    .map(i => {
      const r = catalog[i];
      return {
        nombre: r.nombre,
        descripcion: r.descripcion || null,
        imagen: r.imagen || null,
        enlaceExterno: r.enlaceExterno || null,
        categoria: r.categoria,
        ingredientes: r.ingredientes.length > 0 ? r.ingredientes : null,
        instrucciones: r.instrucciones || null,
        tiempoPreparacion: r.tiempoPreparacion,
        porciones: r.porciones,
        esFavorita: 0,
        userId,
        createdBy: userId,
        familyId,
      };
    });
}
