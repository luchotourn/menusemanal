/**
 * One-time script to enrich master-recipes.json with structured metadata:
 * - containsAlcohol: true if recipe has alcoholic ingredients (not just cooking wine)
 * - isFullMeal: false for condiments, components, drinks, and base recipes
 * - kidFriendly: heuristic based on alcohol, complexity, and type
 *
 * Usage: npx tsx scripts/enrich-catalog.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const catalogPath = resolve(process.cwd(), 'server', 'data', 'master-recipes.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));

// Alcoholic ingredients (as primary ingredient, not trace amounts for cooking)
const ALCOHOL_INGREDIENTS = /\b(vodka|whisky|whiskey|ron\b|rum\b|gin\b|ginebra|champagne|licor|aguardiente|aperol|campari|fernet|cognac|brandy|tequila|mezcal|pisco|grappa)\b/i;

// Cooking wines/vinegars are OK — small amounts used for flavor, alcohol evaporates
const COOKING_WINE = /vinagre|vino (blanco|tinto|rosado)/i;

// Drink tags
const DRINK_TAGS = /\bbebida/i;

// Cocktail/drink names
const COCKTAIL_NAMES = /\b(sour|daiquiri|cocktail|spritz|negroni|mojito|margarita|collins|martini|south side|café al vodka)\b/i;

// Condiment/component patterns — not standalone meals
const COMPONENT_NAMES = /^(chimichurri|glasé|streusel|lemon curd|leche condensada|crema de pistacho|bebida de soja|pasta al huevo)\b/i;

let enriched = 0;

for (const recipe of catalog) {
  const allIngredients = (recipe.ingredientes || []).join(' ').toLowerCase();
  const allTags = (recipe.tags || []).join(' ').toLowerCase();
  const name = recipe.nombre.toLowerCase();

  // --- containsAlcohol ---
  // Check if any ingredient is a primary alcoholic ingredient (not cooking wine/vinegar)
  const hasAlcoholIngredient = recipe.ingredientes?.some((ing: string) => {
    const lower = ing.toLowerCase();
    return ALCOHOL_INGREDIENTS.test(lower) && !COOKING_WINE.test(lower);
  }) || false;

  const isAlcoholicDrink = DRINK_TAGS.test(allTags) && (
    hasAlcoholIngredient || COCKTAIL_NAMES.test(name)
  );

  // Penne al vodka: has vodka as ingredient but it's a cooked pasta dish — still flag it
  recipe.containsAlcohol = hasAlcoholIngredient || isAlcoholicDrink;

  // --- isFullMeal ---
  const isDrink = DRINK_TAGS.test(allTags) || COCKTAIL_NAMES.test(name);
  const isComponent = COMPONENT_NAMES.test(name);
  const isTutorialOnly = allTags.includes('tutorial') && !allTags.includes('almuerzo') && !allTags.includes('cena');

  recipe.isFullMeal = !isDrink && !isComponent && !isTutorialOnly;

  // --- kidFriendly ---
  // Not kid-friendly if: contains alcohol, is a drink, is too complex (>90min), or is a component
  recipe.kidFriendly = !recipe.containsAlcohol && recipe.isFullMeal &&
    (recipe.tiempoPreparacion === null || recipe.tiempoPreparacion <= 90);

  enriched++;
}

writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');

// Print summary
console.log(`Enriched ${enriched} recipes\n`);

console.log('=== containsAlcohol: true ===');
catalog.filter((r: any) => r.containsAlcohol).forEach((r: any) =>
  console.log(`  - ${r.nombre}`)
);

console.log('\n=== isFullMeal: false ===');
catalog.filter((r: any) => !r.isFullMeal).forEach((r: any) =>
  console.log(`  - ${r.nombre}`)
);

console.log('\n=== kidFriendly: false ===');
catalog.filter((r: any) => !r.kidFriendly).forEach((r: any) =>
  console.log(`  - ${r.nombre} ${r.containsAlcohol ? '(alcohol)' : ''} ${!r.isFullMeal ? '(not a meal)' : ''} ${r.tiempoPreparacion > 90 ? '(too long)' : ''}`)
);

console.log(`\nTotals: ${catalog.length} recipes`);
console.log(`  Full meals: ${catalog.filter((r: any) => r.isFullMeal).length}`);
console.log(`  Kid-friendly: ${catalog.filter((r: any) => r.kidFriendly).length}`);
console.log(`  Contains alcohol: ${catalog.filter((r: any) => r.containsAlcohol).length}`);
