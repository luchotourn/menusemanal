// Pure helpers for the meal card — kept free of JSX/React so they can be unit
// tested in the node environment like the weekly-plan hook helpers.

export type PendingProposalSummary = {
  proposedRecipeName: string;
  proposerName: string;
  createdAt: string;
};

// Ordered keyword rules: first match wins, so mains (milanesa, ensalada) come
// before sides that often appear in the same name (puré, papas). Patterns are
// written against normalized text (lowercase, diacritics stripped, ñ → n).
const DISH_EMOJI_RULES: Array<[RegExp, string]> = [
  [/milanesa/, "🥩"],
  [/pizza/, "🍕"],
  [/hamburgues/, "🍔"],
  [/empanada/, "🥟"],
  [/(tarta|quiche)/, "🥧"],
  [/ensalada/, "🥗"],
  [/(sopa|caldo|guiso|lenteja|locro|estofado|cazuela)/, "🍲"],
  [/(pasta|tallarin|fideo|noqui|spaghetti|espagueti|canelon|lasana|raviol)/, "🍝"],
  [/(pollo|pavo)/, "🍗"],
  [/(pescado|merluza|salmon|atun|trucha)/, "🐟"],
  [/sushi/, "🍣"],
  [/(arroz|risotto|paella)/, "🍚"],
  [/(tortilla|omelet|revuelto|huevo)/, "🍳"],
  [/(taco|burrito|fajita|quesadilla)/, "🌮"],
  [/(asado|bife|carne|costilla|matambre|lomo|cerdo|bondiola|churrasco)/, "🥩"],
  [/(sandwich|sanguche|tostado|wrap)/, "🥪"],
  [/(polenta|choclo|humita)/, "🌽"],
  [/(verdura|vegetal|brocoli|zapallito|calabaza|espinaca|acelga|zanahoria)/, "🥦"],
  [/(wok|salteado|curry)/, "🥘"],
  [/(pure|papa)/, "🥔"],
  [/(pan|focaccia|chipa)/, "🥖"],
];

const CATEGORY_EMOJI: Record<string, string> = {
  "Ensalada": "🥗",
  "Sopa": "🍲",
  "Entrada": "🥟",
  "Acompañamiento": "🥔",
  "Plato Principal": "🍽️",
};

const DEFAULT_DISH_EMOJI = "🍽️";

function normalizeDishName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Emoji tile for a dish: keyword match on the name, category fallback, 🍽️ default. */
export function getDishEmoji(nombre: string, categoria?: string | null): string {
  const normalized = normalizeDishName(nombre ?? "");
  for (const [pattern, emoji] of DISH_EMOJI_RULES) {
    if (pattern.test(normalized)) return emoji;
  }
  if (categoria && CATEGORY_EMOJI[categoria]) return CATEGORY_EMOJI[categoria];
  return DEFAULT_DISH_EMOJI;
}

/**
 * Chip copy for pending swap proposals: names the proposed dish when there is
 * exactly one pending proposal (surfaces the decision), generic label otherwise.
 */
export function mealProposalChipLabel(
  pendingProposalCount: number,
  proposal: PendingProposalSummary | null,
): string {
  return pendingProposalCount === 1 && proposal
    ? `Cambio: ${proposal.proposedRecipeName}`
    : "Cambio propuesto";
}
