/**
 * One-time scraper for foodit.lanacion.com.ar
 * Extracts recipes from the site and builds a master catalog JSON file.
 *
 * Usage: npx tsx scripts/scrape-foodit.ts
 */

import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://foodit.lanacion.com.ar';
const RECIPES_URL = `${BASE_URL}/recetas/`;
const DELAY_MS = 500; // Be polite to the server

interface ScrapedRecipe {
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
  dieta: string | null; // vegetariana, vegana, sin gluten, etc.
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MenuSemanal/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function getRecipeUrls(): Promise<string[]> {
  const urls: string[] = [];

  // Scrape the main recipes listing page
  const html = await fetchPage(RECIPES_URL);
  const $ = cheerio.load(html);

  // Recipe links follow the pattern /recetas/{slug}-nid{date}/
  $('a[href*="/recetas/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.match(/\/recetas\/[\w-]+-nid\d+\/?$/)) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
  });

  // Also scrape category pages for more variety
  const categoryPages = [
    '/recetas/saladas/',
    '/recetas/dulces/',
    '/recetas/que-cocinar-hoy/facil/',
    '/recetas/que-cocinar-hoy/rapida/',
    '/recetas/dieta/vegetariana/',
  ];

  for (const page of categoryPages) {
    console.log(`  Scanning category: ${page}`);
    await sleep(DELAY_MS);
    try {
      const catHtml = await fetchPage(`${BASE_URL}${page}`);
      const $cat = cheerio.load(catHtml);
      $cat('a[href*="/recetas/"]').each((_, el) => {
        const href = $cat(el).attr('href');
        if (href && href.match(/\/recetas\/[\w-]+-nid\d+\/?$/)) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          if (!urls.includes(fullUrl)) {
            urls.push(fullUrl);
          }
        }
      });
    } catch (e) {
      console.warn(`  Warning: failed to scrape ${page}`);
    }
  }

  return urls;
}

function parseTime(timeStr: string | undefined): number | null {
  if (!timeStr) return null;
  // Handle ISO 8601 duration format like "PT50M" or "PT1H30M"
  const isoMatch = timeStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (isoMatch) {
    const hours = parseInt(isoMatch[1] || '0');
    const minutes = parseInt(isoMatch[2] || '0');
    return hours * 60 + minutes;
  }
  // Handle plain text like "50 min"
  const minMatch = timeStr.match(/(\d+)\s*min/);
  if (minMatch) return parseInt(minMatch[1]);
  return null;
}

function mapToCategory(keywords: string[]): string {
  const kw = keywords.map(t => t.toLowerCase());

  if (kw.some(t => t.includes('ensalada'))) return 'Ensalada';
  if (kw.some(t => t.includes('sopa') || t.includes('guiso') || t.includes('caldo') || t.includes('crema'))) return 'Sopa';
  if (kw.some(t => t.includes('entrada') || t.includes('aperitivo'))) return 'Entrada';
  if (kw.some(t => t.includes('acompañamiento') || t.includes('guarnición'))) return 'Acompañamiento';
  if (kw.some(t => t.includes('dulce') || t.includes('torta') || t.includes('postre') || t.includes('merienda') || t.includes('galletita'))) return 'Plato Principal';
  if (kw.some(t => t.includes('bebida') || t.includes('cocktail') || t.includes('latte') || t.includes('brew'))) return 'Entrada'; // beverages as "Entrada"
  if (kw.some(t => t.includes('salada'))) return 'Plato Principal';

  return 'Plato Principal';
}

function detectDiet(suitableForDiet: string[] | undefined, keywords: string[]): string | null {
  // Prefer the structured suitableForDiet field from JSON-LD
  if (suitableForDiet && suitableForDiet.length > 0) {
    const dietStr = suitableForDiet.join(' ').toLowerCase();
    if (dietStr.includes('vegan')) return 'vegana';
    if (dietStr.includes('vegetarian')) return 'vegetariana';
    if (dietStr.includes('gluten')) return 'sin gluten';
    if (dietStr.includes('lactose')) return 'sin lactosa';
  }
  // Fallback to keywords
  const kw = keywords.map(t => t.toLowerCase());
  if (kw.some(t => t === 'vegana')) return 'vegana';
  if (kw.some(t => t === 'vegetariana')) return 'vegetariana';
  if (kw.some(t => t === 'sin gluten')) return 'sin gluten';
  if (kw.some(t => t === 'sin lactosa')) return 'sin lactosa';
  if (kw.some(t => t === 'keto')) return 'keto';
  return null;
}

async function scrapeRecipe(url: string): Promise<ScrapedRecipe | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // Try JSON-LD first (most reliable)
    let jsonLd: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        // Could be an array or a single object
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Recipe') {
            jsonLd = item;
          }
          // Sometimes it's nested in @graph
          if (item['@graph']) {
            for (const graphItem of item['@graph']) {
              if (graphItem['@type'] === 'Recipe') {
                jsonLd = graphItem;
              }
            }
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    if (jsonLd) {
      // Use JSON-LD structured data (most reliable)
      const keywords: string[] = jsonLd.keywords
        ? String(jsonLd.keywords).split(',').map((k: string) => k.trim()).filter(Boolean)
        : [];

      const ingredients = Array.isArray(jsonLd.recipeIngredient)
        ? jsonLd.recipeIngredient
        : [];

      const instructions = Array.isArray(jsonLd.recipeInstructions)
        ? jsonLd.recipeInstructions
            .map((step: any) => typeof step === 'string' ? step : step.text || '')
            .filter((s: string) => s.length > 0)
            .join('\n')
        : (typeof jsonLd.recipeInstructions === 'string' ? jsonLd.recipeInstructions : '');

      const image = Array.isArray(jsonLd.image)
        ? jsonLd.image[0]
        : (typeof jsonLd.image === 'object' ? jsonLd.image.url : jsonLd.image);

      const suitableForDiet = Array.isArray(jsonLd.suitableForDiet)
        ? jsonLd.suitableForDiet
        : jsonLd.suitableForDiet ? [jsonLd.suitableForDiet] : undefined;

      return {
        nombre: jsonLd.name || '',
        descripcion: jsonLd.description || '',
        imagen: image || '',
        enlaceExterno: url,
        categoria: mapToCategory(keywords),
        ingredientes: ingredients,
        instrucciones: instructions,
        tiempoPreparacion: parseTime(jsonLd.totalTime) || parseTime(jsonLd.cookTime) || parseTime(jsonLd.prepTime),
        porciones: jsonLd.recipeYield ? parseInt(String(jsonLd.recipeYield)) || null : null,
        tags: keywords,
        dieta: detectDiet(suitableForDiet, keywords),
      };
    }

    // Fallback: extract tags from main content area only (not nav)
    const tags: string[] = [];
    $('main a[href*="/tema/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) tags.push(text);
    });

    // Breadcrumbs for category detection
    const breadcrumbs: string[] = [];
    $('nav[aria-label="Breadcrumb"] li').each((_, el) => {
      breadcrumbs.push($(el).text().trim());
    });

    // Fallback: parse from DOM
    const title = $('article h1').first().text().trim()
      || $('h1').first().text().trim();

    if (!title) return null;

    const description = $('h2').filter((_, el) => $(el).text().trim().length > 50).first().text().trim();

    const ingredients: string[] = [];
    const ingHeading = $('h2, h3, h4').filter((_, el) => $(el).text().trim() === 'Ingredientes');
    if (ingHeading.length) {
      ingHeading.first().next('ul').find('li').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 2) ingredients.push(text);
      });
    }

    const steps: string[] = [];
    const prepHeading = $('h2, h3, h4').filter((_, el) => $(el).text().trim() === 'Preparación');
    if (prepHeading.length) {
      prepHeading.first().next('ol').find('li').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 5) steps.push(text);
      });
    }

    const timeText = $('li').filter((_, el) => $(el).text().includes('Tiempo total')).first().text();

    const image = $('article img').first().attr('src') || '';

    return {
      nombre: title,
      descripcion: description,
      imagen: image,
      enlaceExterno: url,
      categoria: mapToCategory([...tags, ...breadcrumbs]),
      ingredientes: ingredients,
      instrucciones: steps.join('\n'),
      tiempoPreparacion: parseTime(timeText),
      porciones: null,
      tags,
      dieta: detectDiet(undefined, [...tags, ...breadcrumbs]),
    };

  } catch (error) {
    console.error(`  Error scraping ${url}:`, error);
    return null;
  }
}

async function main() {
  console.log('=== Foodit Recipe Scraper ===\n');

  // Step 1: Get recipe URLs
  console.log('Step 1: Collecting recipe URLs...');
  const urls = await getRecipeUrls();
  console.log(`  Found ${urls.length} unique recipe URLs\n`);

  // Step 2: Scrape each recipe
  console.log('Step 2: Scraping individual recipes...');
  const recipes: ScrapedRecipe[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const slug = url.split('/recetas/')[1]?.replace(/\/$/, '') || url;
    console.log(`  [${i + 1}/${urls.length}] ${slug}`);

    const recipe = await scrapeRecipe(url);
    if (recipe && recipe.nombre && recipe.ingredientes.length > 0) {
      recipes.push(recipe);
      console.log(`    ✓ ${recipe.nombre} (${recipe.ingredientes.length} ingredients, ${recipe.tiempoPreparacion || '?'} min)`);
    } else {
      console.log(`    ✗ Skipped (missing data)`);
    }

    await sleep(DELAY_MS);
  }

  // Step 3: Save results
  console.log(`\nStep 3: Saving ${recipes.length} recipes...`);

  const outputPath = resolve(import.meta.dirname || '.', '..', 'server', 'data', 'master-recipes.json');

  // Ensure output directory exists
  const { mkdirSync } = await import('fs');
  mkdirSync(resolve(outputPath, '..'), { recursive: true });

  writeFileSync(outputPath, JSON.stringify(recipes, null, 2), 'utf-8');
  console.log(`  Saved to ${outputPath}`);

  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total recipes: ${recipes.length}`);
  console.log(`With diet tags: ${recipes.filter(r => r.dieta).length}`);
  console.log(`Categories:`);
  const cats = recipes.reduce((acc, r) => { acc[r.categoria] = (acc[r.categoria] || 0) + 1; return acc; }, {} as Record<string, number>);
  Object.entries(cats).forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
  console.log(`Diets:`);
  const diets = recipes.reduce((acc, r) => { if (r.dieta) acc[r.dieta] = (acc[r.dieta] || 0) + 1; return acc; }, {} as Record<string, number>);
  Object.entries(diets).forEach(([diet, count]) => console.log(`  ${diet}: ${count}`));
}

main().catch(console.error);
